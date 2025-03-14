const Razorpay = require('razorpay')
const crypto = require('crypto')
const mongoose = require('mongoose')
const Cart = require('../../models/cartSchema')
const { v4: uuidv4 } = require('uuid');
const Order = require('../../models/orderSchema')
const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')
const Address = require('../../models/addressSchema')

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createRazorpayOrder = async (req, res) => {
    try {
        console.log('req body:', req.body);
        const userId = req.session.user;
        if (!userId) {
            return res.status(400).json({ success: false, message: "User session expired. Please log in again." });
        }

        let addressId = req.body.addressId;

        if (!mongoose.Types.ObjectId.isValid(addressId)) {
            return res.status(400).json({ error: "Invalid address format." });
        }

        const cart = await Cart.findOne({ userId }).populate("items.productId");
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Your cart is empty." });
        }


        cart.items = cart.items.filter(item => item.productId !== null);

     
        if (cart.items.length === 0) {
            return res.json({ success: false, message: "Some products were removed from the store. Please refresh your cart." });
        }

        const totalAmount = ((cart.items.reduce((sum, item) => sum + (item.productId.salePrice * item.quantity), 0)) - (cart.discount || 0)) * 100;

        const options = {
            amount: totalAmount,
            currency: "INR",
            receipt: `receipt_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);
        console.log('created order:', order);

        res.json({
            success: true,
            key: process.env.RAZORPAY_KEY_ID,
            amount: order.amount,
            orderId: order.id,
            currency: order.currency,
        });
    } catch (error) {
        console.error("❌ Error creating Razorpay order:", error);
        res.status(500).json({ success: false, message: "Error creating Razorpay order" });
    }
};

const verifyPayment = async (req, res) => {
    try {
        const { orderId, paymentId, signature, addressId } = req.body;
        const orderIds = [];

        if (!orderId || !paymentId || !signature || !addressId) {
            return res.status(400).json({ success: false, message: "Invalid payment data." });
        }

        // Verify Payment Signature
        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(orderId + "|" + paymentId)
            .digest("hex");

        if (generatedSignature !== signature) {
            return res.json({ success: false, message: "Payment verification failed. Please try again." });
        }

        const userId = req.session.user;
        if (!userId) {
            return res.status(400).json({ success: false, message: "User session expired. Please log in again." });
        }

        if (!mongoose.Types.ObjectId.isValid(addressId)) {
            return res.status(400).json({ success: false, message: "Invalid address format." });
        }

        const selectedAddress = await Address.findOne({ userId, "address._id": addressId });
        if (!selectedAddress) return res.status(404).json({ success: false, message: "Address not found." });

        const addressDetails = selectedAddress.address.find(addr => addr._id.equals(addressId));

        const cart = await Cart.findOne({ userId }).populate("items.productId");
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Your cart is empty." });
        }

        let totalCartPrice = cart.items.reduce((sum, item) => sum + (item.productId.salePrice * item.quantity), 0);
        let totalCouponDiscount = cart.discount || 0;

        for (let item of cart.items) {
            if (!item.productId) {
                return res.json({ success: false, message: "One or more products are unavailable." });
            }

            const existingProduct = await Product.findById(item.productId._id);
            if (!existingProduct) {
                return res.json({ success: false, message: `${item.productId.productName} is no longer available.` });
            }

            if (existingProduct.isBlocked) {
                return res.json({ success: false, message: `${item.productId.productName} is blocked.` });
            }

            if (existingProduct.stock < item.quantity) {
                return res.json({ success: false, message: `${item.productId.productName} is out of stock.` });
            }

            const finalPrice = existingProduct.salePrice;
            const totalPrice = finalPrice * item.quantity;

            const proportionateCouponDiscount = totalCouponDiscount * (totalPrice / totalCartPrice);

            const category = await Category.findById(existingProduct.category);
            const productOffer = existingProduct.productOffer || 0;
            const categoryOffer = category ? category.categoryOffer || 0 : 0;
            const bestOffer = Math.max(productOffer, categoryOffer);

            const newOrder = new Order({
                userId,
                product: existingProduct._id,
                productName: existingProduct.productName,
                productImage: Array.isArray(existingProduct.productImage) ? existingProduct.productImage : [existingProduct.productImage],
                quantity: item.quantity,
                price: existingProduct.salePrice,
                finalPrice,
                totalPrice,
                discount: bestOffer,
                couponDiscount: proportionateCouponDiscount,
                status: "pending",
                address: {
                    fullName: addressDetails.name,
                    mobile: addressDetails.phone,
                    street: addressDetails.streetAddress,
                    city: addressDetails.city,
                    state: addressDetails.state,
                    pincode: addressDetails.pincode,
                },
                paymentMethod: "razorpay",
                paymentStatus: "paid",
                createdOn: new Date(),
            });

            await newOrder.save();
            orderIds.push(newOrder.orderId); 

         
            await Product.findByIdAndUpdate(existingProduct._id, {
                $inc: { stock: -item.quantity }
            });
        }

    
        await Cart.findOneAndUpdate(
            { userId },
            { $unset: { discount: 1, couponCode: 1 }, $set: { items: [], cartTotal: 0, finalTotal: 0 } }
        );

        return res.json({ success: true, message: "Order placed successfully!", orderId: orderIds });

    } catch (error) {
        console.error("❌ Error verifying payment:", error);
        res.status(500).json({ success: false, message: "Payment verification failed." });
    }
};


module.exports = {

    createRazorpayOrder,
    verifyPayment,
  
}