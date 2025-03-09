const Razorpay = require('razorpay')
const crypto = require('crypto')
const mongoose = require('mongoose')
const Cart = require('../../models/cartSchema')
const { v4: uuidv4 } = require('uuid');
const Order = require('../../models/orderSchema')
const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')

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

        const totalAmount = ((cart.cartTotal) - (cart.discount || 0)) * 100;

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

        if (!orderId || !paymentId || !signature || !addressId) {
            return res.status(400).json({ success: false, message: "Invalid payment data." });
        }

        // Generate expected signature
        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(orderId + "|" + paymentId)
            .digest("hex");

        const paymentVerified = generatedSignature === signature;

        if (!paymentVerified) {
            return res.json({ success: false, message: "Payment verification failed. Please try again." });
        }

        const userId = req.session.user;
        if (!userId) {
            return res.status(400).json({ success: false, message: "User session expired. Please log in again." });
        }

        const cart = await Cart.findOne({ userId }).populate("items.productId");
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Your cart is empty." });
        }

        let totalCartPrice = cart.items.reduce((sum, item) => sum + (item.productId.salePrice * item.quantity), 0);
        let totalCouponDiscount = cart.discount || 0;

        for (let item of cart.items) {
            if (!item.productId) return res.json({ success: false, message: "One or more products are unavailable." });
            if (item.productId.stock < item.quantity) {
                return res.json({ success: false, message: `${item.productId.productName} is out of stock.` });
            }

            const finalPrice = item.productId.salePrice;
            const totalPrice = finalPrice * item.quantity;

            const proportionateCouponDiscount = totalCouponDiscount * (totalPrice / totalCartPrice);

            const category = await Category.findById(item.productId.category);
            const productOffer = item.productId.productOffer || 0;
            const categoryOffer = category ? category.categoryOffer || 0 : 0;
            const bestOffer = Math.max(productOffer, categoryOffer);

            const newOrder = new Order({
                userId,
                product: item.productId._id,
                quantity: item.quantity,
                price: item.productId.salePrice,
                finalPrice,
                totalPrice,
                discount: bestOffer,
                couponDiscount: proportionateCouponDiscount,
                status: "pending",
                address: addressId,
                paymentMethod: "razorpay",
                paymentStatus: "paid",
                createdOn: new Date(),
            });

            await newOrder.save();
            await Product.findByIdAndUpdate(item.productId, { $inc: { quantity: -item.quantity } });
        }

        await Cart.findOneAndUpdate({ userId }, { $unset: { discount: 1, couponCode: 1 }, $set: { items: [], cartTotal: 0, finalTotal: 0 } });

        res.json({ success: true, message: "Order placed successfully!" });
    } catch (error) {
        console.error("❌ Error verifying payment:", error);
        res.status(500).json({ success: false, message: "Payment verification failed." });
    }
};



module.exports = {

    createRazorpayOrder,
    verifyPayment
}