const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Address = require("../../models/addressSchema"); // Assuming you have an Address model
const Cart = require("../../models/cartSchema");
const Order = require("../../models/orderSchema");  
const mongoose = require("mongoose");
const { v4: uuidv4 } = require('uuid');


const loadCheckoutPage = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) return res.redirect("/login");

        const user = await User.findById(userId);
        if (!user) return res.status(404).send("User not found");

        const cart = await Cart.findOne({ userId }).populate({
            path: "items.productId",
            model: "Product",
            populate: {
                path: "category",
                model: "Category",
            },
        });

        // ✅ Fetch all addresses instead of just one
        const addresses = await Address.find({ userId });

        if (!cart || cart.items.length === 0) {
            return res.render("checkout", {
                user,
                cartItems: [],
                subtotal: 0,
                totalDiscount: 0,
                shippingCharge: 0,
                grandTotal: 0,
                addresses, // Pass all addresses
            });
        }

    

        const cartItems = cart.items.filter(item =>
            item.productId &&
            !item.productId.isBlocked &&
            item.productId.category && 
            item.productId.category.isListed !== false
        );


        let totalDiscount = 0;
        let subtotal = 0;

        cartItems.forEach(item => {
            const offerPercentage = item.productId.productOffer || 0;
            const discountAmount = (item.productId.salePrice * offerPercentage) / 100;
            totalDiscount += discountAmount * item.quantity;

            item.discountedPrice = item.productId.salePrice - discountAmount;
            item.totalPrice = item.discountedPrice * item.quantity;

            subtotal += item.totalPrice;
        });

        const shippingCharge = 0; // Free shipping
        const grandTotal = subtotal + shippingCharge;

        res.render("checkout", {
            user,
            cartItems,
            subtotal,
            totalDiscount,
            shippingCharge,
            grandTotal,
            addresses, 
        });
    } catch (error) {
        console.error("Error in loadCheckoutPage:", error);
        res.redirect("/pageNotFound");
    }
};

  

const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
        
            return res.status(400).json({ success: false, message: "User session expired. Please log in again." });
        }

        let addressId = req.body.addressId;
       

        if (!mongoose.Types.ObjectId.isValid(addressId)) {
            return res.status(400).json({ error: "Invalid address format." });
        }

        addressId = new mongoose.Types.ObjectId(addressId);
        console.log(" Selected Address ID:", addressId);

        // Ensure the address belongs to the current user
        const selectedAddress = await Address.findOne({
            userId: userId,
            address: { $elemMatch: { _id: addressId } }
        });

        if (!selectedAddress) {
          
            return res.status(400).json({ error: "Address not found in user records." });
        }
        
        // Extract the specific address from the array
        const addressDetails = selectedAddress.address.find(addr => addr._id.equals(addressId));


        // Fetch user's cart and populate products
        const cart = await Cart.findOne({ userId }).populate("items.productId");

        if (!cart || cart.items.length === 0) {
            return res.json({ success: false, message: "Your cart is empty." });
        }

        // Ensure products exist before processing
        for (let item of cart.items) {
            if (!item.productId) {
                console.error(` Error: Product not found for item:`, item);
                return res.json({ success: false, message: "One or more products in your cart are unavailable." });
            }

            if (item.productId.stock < item.quantity) {
                return res.json({ success: false, message: `${item.productId.productName} is out of stock.` });
            }
        }

        // Prepare order items with unique `itemId`
        const orderItems = cart.items.map(item => ({
            itemId: uuidv4(), // Generate unique item ID
            product: item.productId._id,
            quantity: item.quantity,
            price: item.productId.salePrice,
            total: item.quantity * item.productId.salePrice,
            status: "pending" // Each item has its own status
        }));

        const totalPrice = orderItems.reduce((sum, item) => sum + item.total, 0);
        const finalAmount = totalPrice;

        
        const newOrder = new Order({
            userId: userId,
            address: addressId, 
            orderedItems: orderItems,  
            totalPrice,
            finalAmount,
            couponApplied: false, 
            createdOn: new Date()
        });

        await newOrder.save();
      

        // Reduce stock quantity
        for (let item of cart.items) {
            await Product.findByIdAndUpdate(item.productId._id, {
                $inc: { quantity: -item.quantity }
            });
        }

        // Clear user cart
        await Cart.findOneAndDelete({ userId });

        return res.json({ success: true, message: "Order placed successfully!" });

    } catch (error) {
        console.error("❌ Error placing order:", error);
        return res.status(500).json({ success: false, message: "Something went wrong. Try again!" });
    }
};



const getOrders = async (req, res) => {
    try {
        let userId = req.session.user;

      
    

        if (!mongoose.Types.ObjectId.isValid(userId)) {
           
            return res.render("orders", { orders: [] });
        }

        userId = new mongoose.Types.ObjectId(userId);

        const orders = await Order.find({ userId })
            .populate("orderedItems.product")
            .sort({ createdOn: -1 });

      
      

        res.render("orders", { orders });
    } catch (error) {
        console.error(" Error fetching orders:", error);
        res.status(500).send("Something went wrong.");
    }
};


module.exports = {
    loadCheckoutPage,
    placeOrder,
    getOrders,

}