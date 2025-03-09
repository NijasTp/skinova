const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Coupon = require("../../models/couponSchema");
const Address = require("../../models/addressSchema");
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


        const addresses = await Address.findOne({ userId });

        const userAddresses = addresses ? addresses.address : [];

        const coupons = await Coupon.find({ isActive: true });

        let totalDiscount = cart.discount;
        let subtotal = 0;

        // Find coupons used by the user
        const usedCoupons = coupons
            .filter(coupon => coupon.usedBy.some(entry => entry.userId.toString() === userId.toString() && entry.timesUsed > 0))
            .map(coupon => coupon.code); // Extract used coupon codes


        if (!cart || cart.items.length === 0) {
            return res.render("checkout", {
                user,
                cart: { cartTotal: 0, finalTotal: 0, discount: 0 },
                cartItems: [],
                subtotal: 0,
                totalDiscount,
                shippingCharge: 0,
                grandTotal: 0,
                addresses: userAddresses,
                coupons, 
                usedCoupons
            });
        }

        const cartItems = cart.items.filter(item =>
            item.productId &&
            !item.productId.isBlocked &&
            item.productId.category &&
            item.productId.category.isListed !== false
        );



        cartItems.forEach(item => {
            const offerPercentage = item.productOffer || 0;  
            const discountAmount = item.discountedPrice ? (item.productId.salePrice - item.discountedPrice) : 0;
            const couponDiscount = item.couponDiscount || 0;
        
            totalDiscount += (discountAmount + couponDiscount) * item.quantity;
        
            item.totalPrice = (item.discountedPrice || item.productId.salePrice) * item.quantity;
        
            subtotal += item.totalPrice;
        });
        

        const shippingCharge = 0;
        const grandTotal = subtotal + shippingCharge;

        cart.finalTotal = grandTotal;
        await cart.save();

        res.render("checkout", {
            user,
            cart,
            cartItems,
            subtotal,
            totalDiscount,
            shippingCharge,
            grandTotal,
            addresses: userAddresses,
            coupons, 
            usedCoupons
        });

    } catch (error) {
        console.error("Error in loadCheckoutPage:", error);
        res.redirect("/pageNotFound");
    }
};

const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) return res.status(401).json({ success: false, message: "User session expired. Please log in again." });

        let { addressId, paymentMethod } = req.body;
        if (!mongoose.Types.ObjectId.isValid(addressId)) {
            return res.status(400).json({ success: false, message: "Invalid address format." });
        }

       

        addressId = new mongoose.Types.ObjectId(addressId);

        // Fetch the selected address
        const selectedAddress = await Address.findOne({ userId, "address._id": addressId });
        if (!selectedAddress) return res.status(404).json({ success: false, message: "Address not found." });

        const addressDetails = selectedAddress.address.find(addr => addr._id.equals(addressId));

        // Fetch the user's cart
        const cart = await Cart.findOne({ userId }).populate("items.productId");
        if (!cart || cart.items.length === 0) return res.json({ success: false, message: "Your cart is empty." });

        let totalCartPrice = cart.items.reduce((sum, item) => sum + (item.productId.salePrice * item.quantity), 0);
        let totalCouponDiscount = cart.discount || 0; // Total coupon discount applied

        if (paymentMethod === "cod" && (totalCartPrice - totalCouponDiscount) > 1500) {
            return res.json({ success: false, message: "Cash on Delivery is only for orders less than ₹1500." });
        }

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
                address: addressDetails._id,
                paymentMethod,
                paymentStatus: paymentMethod === "razorpay" ? "paid" : "pending",
                createdOn: new Date(),
            });

            await newOrder.save();

   
            await Product.findByIdAndUpdate(item.productId, {
                $inc: { quantity: -item.quantity }
            });
        }

        
        await Cart.findOneAndUpdate({ userId }, { $unset: { discount: 1, couponCode: 1 }, $set: { items: [], cartTotal: 0, finalTotal: 0 } });

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
            return res.render("orders", { orders: [], currentPage: 1, totalPages: 1 });
        }

        userId = new mongoose.Types.ObjectId(userId);


        const page = parseInt(req.query.page) || 1;  
        const limit = 5;  
        const skip = (page - 1) * limit;

        const totalOrders = await Order.countDocuments({ userId }); 
        const totalPages = Math.ceil(totalOrders / limit); 

        const orders = await Order.find({ userId })
            .populate("product")
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit);

        res.render("orders", { orders, currentPage: page, totalPages });
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).send("Something went wrong.");
    }
};



module.exports = {
    loadCheckoutPage,
    placeOrder,
    getOrders,

}