const Razorpay = require('razorpay')
const crypto = require('crypto')
const mongoose = require('mongoose')
const Cart= require('../../models/cartSchema')
const { v4: uuidv4 } = require('uuid');
const Order = require('../../models/orderSchema')
const Product = require('../../models/productSchema')

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createRazorpayOrder= async (req, res) => {
    try {

        console.log('req body:',req.body)
        const userId = req.session.user;
        if (!userId) {
            return res.status(400).json({ success: false, message: "User session expired. Please log in again." });
        }

        let addressId = req.body.addressId;

        if (!mongoose.Types.ObjectId.isValid(addressId)) {
            return res.status(400).json({ error: "Invalid address format." });
        }

        // Get user's cart
        const cart = await Cart.findOne({ userId }).populate("items.productId");
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Your cart is empty." });
        }

        // Calculate total price
        const totalAmount = cart.items.reduce((sum, item) => sum + item.quantity * item.productId.salePrice, 0) * 100; // Convert to paise

        // Create Razorpay Order
        const options = {
            amount: totalAmount,
            currency: "INR",
            receipt: `receipt_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);
        console.log('created order:',order)

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

        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(orderId + "|" + paymentId)
            .digest("hex");

        if (generatedSignature !== signature) {
            return res.status(400).json({ success: false, message: "Invalid payment signature" });
        }

        // Payment verified, now create the order
        const userId = req.session.user;
        if (!userId) {
            return res.status(400).json({ success: false, message: "User session expired. Please log in again." });
        }

        const cart = await Cart.findOne({ userId }).populate("items.productId");
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Your cart is empty." });
        }

        const orderItems = cart.items.map(item => ({
            itemId: uuidv4(),
            product: item.productId._id,
            quantity: item.quantity,
            price: item.productId.salePrice,
            total: item.quantity * item.productId.salePrice,
            status: "pending",
        }));

        const totalPrice = orderItems.reduce((sum, item) => sum + item.total, 0);

        const newOrder = new Order({
            userId,
            address: addressId,
            orderedItems: orderItems,
            totalPrice,
            finalAmount: totalPrice,
            paymentStatus: "paid",
            paymentMethod: "razorpay",
            createdOn: new Date(),
        });

        await newOrder.save();

        // Reduce stock
        for (let item of cart.items) {
            await Product.findByIdAndUpdate(item.productId._id, { $inc: { quantity: -item.quantity } });
        }

        // Clear cart
        await Cart.findOneAndDelete({ userId });

        res.json({ success: true, message: "Order placed successfully!" });
    } catch (error) {
        console.error("❌ Error verifying payment:", error);
        res.status(500).json({ success: false, message: "Payment verification failed." });
    }
};


module.exports={
    createRazorpayOrder,
    verifyPayment
}