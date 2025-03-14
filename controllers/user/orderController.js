const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Order = require('../../models/orderSchema');
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const Coupon = require('../../models/couponSchema')
const Cart = require('../../models/cartSchema')
const Wallet = require('../../models/walletSchema')
const Address = require('../../models/addressSchema')
const Product = require('../../models/productSchema')


const cancelOrder = async (req, res) => {
    try {
        const { itemId } = req.params; 
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ error: "Cancellation reason is required" });
        }

        const order = await Order.findById(itemId)
            .populate("product", "productName salePrice");

        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }

        if (!["pending", "confirmed"].includes(order.status)) {
            return res.status(400).json({ error: "Order cannot be cancelled at this stage" });
        }

        await Product.findByIdAndUpdate(order.product, { $inc: { quantity: order.quantity } });

        order.status = "cancelled";
        order.cancellationReason = reason;

        if (order.paymentMethod === "razorpay") {
            const wallet = await Wallet.findOne({ userId: order.userId });
            if (!wallet) {
                return res.status(404).json({ error: "Wallet not found" });
            }

            wallet.balance += order.finalPrice*order.quantity;
            wallet.transactions.push({
                type: "credit",
                amount: order.finalPrice*order.quantity,
                date: new Date(),
                description: `Refund due to order cancellation of ${order.product.productName}`,
                orderId:itemId
            });

            await wallet.save();
        }

        await order.save();

        res.status(200).json({ success: "Order cancelled successfully" });
    } catch (error) {
        console.error("Cancel Order Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};


const downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
 
        const order = await Order.findOne({ _id: orderId })
            .populate("product", "productName salePrice")
            .populate("userId", "name email")
            .populate("address"); 

        if (!order) {
            return res.status(404).send("Order not found");
        }

        const userAddress = await Address.findOne({ _id: order.address });
        const selectedAddress = userAddress?.address.find(addr => addr.isPrimary);
        

        const invoiceDir = path.join(__dirname, "../invoices");
        if (!fs.existsSync(invoiceDir)) {
            fs.mkdirSync(invoiceDir, { recursive: true });
        }

       
        const invoicePath = path.join(invoiceDir, `invoice-${orderId}.pdf`);

        
        const doc = new PDFDocument();
        const writeStream = fs.createWriteStream(invoicePath);
        doc.pipe(writeStream);

   
        doc.fontSize(20).text("Skinova Invoice", { align: "center" }).moveDown();
        doc.fontSize(14).text(`Order ID: ${order.orderId}`);
        doc.text(`Date: ${new Date(order.createdOn).toLocaleDateString()}`);
        doc.text(`Customer: ${order.userId?.name || "Unknown"}`);
        doc.text(`Email: ${order.userId?.email || "Unknown"}`).moveDown();

   
     

    
        doc.fontSize(16).text("Product Details", { underline: true }).moveDown();
        doc.fontSize(12).text(`Product: ${order.product.productName}`);
        doc.text(`Quantity: ${order.quantity}`);
        doc.text(`Unit Price: ₹${order.product.salePrice}`);
        doc.text(`Total Price: ₹${order.finalPrice}`);

        doc.moveDown();
        doc.fontSize(14).text(`Final Amount: ₹${order.finalPrice}`, { bold: true });

        doc.end();

    
        writeStream.on("finish", () => {
            res.download(invoicePath, `invoice-${orderId}.pdf`, (err) => {
                if (!err) {
                    // Delete file after download
                    fs.unlinkSync(invoicePath);
                } else {
                    console.error("Invoice Download Error:", err);
                }
            });
        });

    } catch (error) {
        console.error("Invoice Generation Error:", error);
        res.status(500).send("Error generating invoice");
    }
};



const RETURN_PERIOD_DAYS = 7; 

const orderDetails = async (req, res) => {
    const { orderId } = req.params;

    try {
        const order = await Order.findOne({ _id: new mongoose.Types.ObjectId(orderId) })
            .populate('product')
            .populate('userId')
            .exec();

        if (!order) {
            return res.status(404).send('Order not found');
        }

        const userAddresses = await Address.findOne({ userId: order.userId });
        const selectedAddress = userAddresses.address.find(addr => addr._id.toString() === order.address.toString());

 
     
        let returnEligible = false;
        let daysLeft = 0;

        if (order.status === "delivered" && order.deliveredOn) {
            const returnExpiry = new Date(order.deliveredOn);
            returnExpiry.setDate(returnExpiry.getDate() + RETURN_PERIOD_DAYS); 

            const today = new Date();
            if (today <= returnExpiry) {
                returnEligible = true;
                daysLeft = Math.ceil((returnExpiry - today) / (1000 * 60 * 60 * 24)); 
            }
        }

        res.render('order-details', { order, returnEligible, daysLeft });


    } catch (error) {
        console.error("Error fetching order:", error);
        res.status(500).send('Server error');
    }
};




const requestReturn = async (req, res) => {
    try {
      const { orderId, returnReason } = req.body;
      const order = await Order.findById(orderId);
  
      if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }
  
      if (order.status !== "delivered") {
        return res.status(400).json({ success: false, message: "Only delivered orders can be returned" });
      }
  
      order.status = "return request";
      order.returnRequested = true;
      order.returnReason = returnReason;
      await order.save();
  
      res.json({ success: true, message: "Return request submitted successfully" });
    } catch (error) {
      console.error("Error requesting return:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  };
  

  const applyCoupon = async (req, res) => {
    try {
        const { couponCode } = req.body;
        const userId = req.session.user; 

        if (!userId) {
            return res.status(401).json({ success: false, message: "Login required" });
        }

        const cart = await Cart.findOne({ userId }).populate("items.productId");

        if (!cart || !cart.items || cart.items.length === 0) {
            console.log("Cart is empty, returning response");  
            return res.json({ success: false, message: "Your cart is empty! " });
        }
        

        const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
        if (!coupon) {
            return res.status(400).json({ success: false, message: "Invalid coupon" });
        }

        const today = new Date();
        if (today < coupon.startDate) {
            return res.status(400).json({ success: false, message: `Coupon can only be used after ${coupon.startDate.toLocaleDateString()}` });
        }

        if (today > coupon.expireOn) {
            return res.status(400).json({ success: false, message: "Coupon expired" });
        }

        if (cart.cartTotal < coupon.minimumPrice) {
            return res.json({
                success: false,
                message: `Minimum order price should be ₹${coupon.minimumPrice}`,
            });
        }
        
        let userCouponUsage = coupon.usedBy.find(entry => entry.userId.toString() === userId);
        if (userCouponUsage && userCouponUsage.timesUsed >= coupon.usageLimit) {
            return res.status(400).json({ success: false, message: "Coupon usage limit reached" });
        }

        let discount = coupon.offerPrice;
        if (coupon.discountType === "percentage") {
            discount = (coupon.offerPrice / 100) * cart.cartTotal;
        }

        discount = Math.min(discount, cart.cartTotal); // Ensure discount does not exceed cart total

        // **Proportionally Distribute Discount Across Items**
        let totalCartPrice = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
        cart.items.forEach(item => {
            let itemShare = item.totalPrice / totalCartPrice;
            let itemDiscount = Math.round(discount * itemShare);

            item.totalPrice -= itemDiscount; // Reduce the price by the discount
        });

        cart.discount = discount;
        cart.couponCode = couponCode.toUpperCase();

        await cart.save();

        const userIndex = coupon.usedBy.findIndex(entry => entry.userId.toString() === userId);
        if (userIndex === -1) {
            coupon.usedBy.push({ userId, timesUsed: 1 });
        } else {
            coupon.usedBy[userIndex].timesUsed += 1;
        }
        await coupon.save();

        return res.json({
            success: true,
            message: "Coupon applied successfully",
            discount: discount
        });

    } catch (error) {
        console.error("Apply coupon error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const clearCoupons = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Login required" });
        }


        const cart = await Cart.findOne({ userId });
        if (!cart || !cart.couponCode) {
            return res.status(404).json({ success: false, message: "No coupon applied" });
        }


        const coupon = await Coupon.findOne({ code: cart.couponCode.toUpperCase() });
        if (coupon) {
           
            coupon.usedBy = coupon.usedBy.filter(entry => entry.userId.toString() !== userId);
            await coupon.save();
        }

     
        cart.discount = 0;
        cart.couponCode = null;

  
        cart.items.forEach(item => {
            item.totalPrice = item.price * item.quantity; 
        });

        await cart.save();

        return res.json({ success: true, message: "Coupon removed successfully" });
    } catch (error) {
        console.error("Clear coupon error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

module.exports = {
    cancelOrder,
    downloadInvoice,
    orderDetails,
    requestReturn,
    applyCoupon,
    clearCoupons

}