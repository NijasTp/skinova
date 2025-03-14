const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Coupon = require("../../models/couponSchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const Order = require("../../models/orderSchema");
const Wallet = require('../../models/walletSchema')
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

        if (cart && cart.items.length === 0) {
            return res.redirect("/cart");
        }

        const addresses = await Address.findOne({ userId });
        const userAddresses = addresses ? addresses.address : [];
        const today = new Date();

        const coupons = await Coupon.find({ 
            isActive: true,
            startDate: { $lte: today },  
            expireOn: { $gte: today }    
        });

        let totalDiscount = cart.discount;
        let subtotal = 0;

        const usedCoupons = coupons
            .filter(coupon => coupon.usedBy.some(entry => entry.userId.toString() === userId.toString() && entry.timesUsed > 0))
            .map(coupon => coupon.code);

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
            item.productId.quantity > 0 &&
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

        const selectedAddress = await Address.findOne({ userId, "address._id": addressId });
        if (!selectedAddress) return res.status(404).json({ success: false, message: "Address not found." });

        const addressDetails = selectedAddress.address.find(addr => addr._id.equals(addressId));

        const cart = await Cart.findOne({ userId }).populate("items.productId");
        if (!cart || cart.items.length === 0) return res.json({ success: false, message: "Products are missing." });

        cart.items = cart.items.filter(item => item.productId !== null);

        if (cart.items.length === 0) {
            return res.json({ success: false, message: "Some products were removed from the store. Please refresh your cart." });
        }

        let totalCartPrice = cart.items.reduce((sum, item) => sum + (item.productId.salePrice * item.quantity), 0);
        let totalCouponDiscount = cart.discount || 0;

        if (paymentMethod === "cod" && (totalCartPrice - totalCouponDiscount) > 1500) {
            return res.json({ success: false, message: "Cash on Delivery is only for orders less than ₹1500." });
        }

        let firstOrderId = null;

        for (let item of cart.items) {
            if (!item.productId) return res.json({ success: false, message: "One or more products are unavailable." });

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
                paymentMethod,
                paymentStatus: paymentMethod === "razorpay" ? "paid" : "pending",
                createdOn: new Date(),
            });

            if (!firstOrderId) firstOrderId = newOrder.orderId;

            await newOrder.save();

            await Product.findByIdAndUpdate(existingProduct._id, {
                $inc: { stock: -item.quantity }
            });
        }

        await Cart.findOneAndUpdate(
            { userId },
            { $unset: { discount: 1, couponCode: 1 }, $set: { items: [], cartTotal: 0, finalTotal: 0 } }
        );

        return res.json({ success: true, message: "Order placed successfully!", orderId: firstOrderId });


    } catch (error) {
        console.error("❌ Error placing order:", error);
        return res.status(500).json({ success: false, message: "Something went wrong. Try again!" });
    }
};


const walletPayment = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) return res.status(401).json({ success: false, message: "User session expired. Please log in again." });

        let { addressId } = req.body;
        if (!mongoose.Types.ObjectId.isValid(addressId)) {
            return res.status(400).json({ success: false, message: "Invalid address format." });
        }

        addressId = new mongoose.Types.ObjectId(addressId);

        const selectedAddress = await Address.findOne({ userId, "address._id": addressId });
        if (!selectedAddress) return res.status(404).json({ success: false, message: "Address not found." });

        const addressDetails = selectedAddress.address.find(addr => addr._id.equals(addressId));

        const cart = await Cart.findOne({ userId }).populate("items.productId");
        if (!cart || cart.items.length === 0) return res.json({ success: false, message: "Products are missing." });

        cart.items = cart.items.filter(item => item.productId !== null);

        if (cart.items.length === 0) {
            return res.json({ success: false, message: "Some products were removed from the store. Please refresh your cart." });
        }

        let totalCartPrice = cart.items.reduce((sum, item) => sum + (item.productId.salePrice * item.quantity), 0);
        let totalCouponDiscount = cart.discount || 0; 
        let finalAmount = totalCartPrice - totalCouponDiscount;


        let wallet = await Wallet.findOne({ userId });
        if (!wallet || wallet.balance < finalAmount) {
            return res.json({ success: false, message: "Insufficient wallet balance." });
        }

        wallet.balance -= finalAmount;
        wallet.transactions.push({
            type: "debit",
            amount: finalAmount,
            description: "Order Payment via Wallet",
            date: new Date(),
        });

        await wallet.save();
        let firstOrderId = null;
        for (let item of cart.items) {
            if (!item.productId) return res.json({ success: false, message: "One or more products are unavailable." });

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
                paymentMethod: "wallet",
                paymentStatus: "paid",
                createdOn: new Date(),
            });

            if (!firstOrderId) firstOrderId = newOrder.orderId;


            await newOrder.save();

            await Product.findByIdAndUpdate(existingProduct._id, {
                $inc: { stock: -item.quantity }
            });
        }

        await Cart.findOneAndUpdate(
            { userId },
            { $unset: { discount: 1, couponCode: 1 }, $set: { items: [], cartTotal: 0, finalTotal: 0 } }
        );

        return res.json({ success: true, message: "Order placed successfully!", orderId: firstOrderId });

    } catch (error) {
        console.error("❌ Error in wallet payment:", error);
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

const orderSuccess = (req, res) => {
try {
    const { orderId } = req.query;
    res.render("order-success", { orderId });
} catch (error) {
    console.log('error fetching order success:', error);
    res.redirect('/pageNotFound')
}
}

const orderFailure = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.redirect("/login");
        }

        const userCart = await Cart.findOne({ userId }).populate("items.productId");

        if (!userCart || userCart.items.length === 0) {
            return res.redirect("/cart");
        }

        const { orderId, amount, currency, key, addressId } = req.query; 
        res.render("order-failure", { orderId, amount, currency, key, addressId });
    } catch (error) {
        console.log('Error fetching order failure:', error);
        res.redirect('/pageNotFound');
    }
};


module.exports = {
    loadCheckoutPage,
    placeOrder,
    getOrders,
    walletPayment,
    orderFailure,
    orderSuccess

}