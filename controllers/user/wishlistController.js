const Wishlist = require('../../models/wishlistSchema')
const Product = require('../../models/productSchema')
const Cart= require('../../models/cartSchema')
const express= require('express')
const router= express.Router()

const loadWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) return res.redirect("/login");

        let wishlist = await Wishlist.findOne({ userId }).populate("products.productId").lean();

        if (wishlist) {
            
            const validProducts = wishlist.products.filter(item => item.productId !== null && !item.productId.isBlocked);

            
            if (validProducts.length !== wishlist.products.length) {
                await Wishlist.updateOne({ userId }, { $set: { products: validProducts } });
            }

            wishlist.products = validProducts;
        }

        res.render("wishlist", { wishlist });
    } catch (error) {
        console.error(" Error fetching wishlist:", error);
        res.status(500).send("Internal Server Error");
    }
};


const addToWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Please log in first" });
        }

        const productId = req.query.id;
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        if (product.isBlocked) {
            return res.status(400).json({ success: false, message: "This product is not available for adding to wishlist" });
        }
        
        if (product.quantity === 0) {
            return res.status(400).json({ success: false, message: "This product is out of stock" });
        }
       
        const cart = await Cart.findOne({ userId, "items.productId": productId });
        if (cart) {
            return res.json({ success: false, message: "Item is already in the cart!" });
        }

        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            wishlist = new Wishlist({ userId, products: [] });
        }

        const productExists = wishlist.products.some((item) => item.productId.equals(productId));

        if (!productExists) {
            wishlist.products.push({ productId });
            await wishlist.save();
            return res.json({ success: true, message: "Product added to wishlist" });
        } else {
            return res.json({ success: false, message: "Product already in wishlist" });
        }
    } catch (error) {
        console.error("Error adding to wishlist:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};


const deleteFromWishlist= async (req,res)=>{
    try {
        const userId = req.session.user;
        if (!userId) return res.redirect("/login");

        const productId = req.query.id;
        await Wishlist.updateOne({ userId }, { $pull: { products: { productId } } });

        return res.redirect("/wishlist");
    } catch (error) {
        console.error("Error removing from wishlist:", error);
        return res.status(500).send("Internal Server Error");
    }
}

module.exports={
    loadWishlist,
    addToWishlist,
    deleteFromWishlist
}