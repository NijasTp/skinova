const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Review = require("../../models/reviewSchema");


const productDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const productId = req.query.id;
        const product = await Product.findById(productId).populate('category');

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found.' });
        }

        if (!product.category.isListed) {
            return res.redirect("/shop");
        }

        const findCategory = product.category;
        const categoryOffer = findCategory?.categoryOffer || 0;
        const productOffer = product.productOffer || 0;
        const totalOffer = categoryOffer + productOffer;

        const categories = await Category.find({ isListed: true });
        const categoryIds = categories.map(category => category._id.toString());

        const products = await Product.find({
            isBlocked: false,
            category: { $in: categoryIds },
            quantity: { $gt: 0 },
        })
        .sort({ createdOn: -1 })
        .limit(9);

        // Fetch reviews with pagination
        const page = parseInt(req.query.page) || 1;
        const reviewsPerPage = 5; 
        const reviews = await Review.find({ productId })
            .populate('userId', 'name')
            .sort({ createdAt: -1 })
            .skip((page - 1) * reviewsPerPage)
            .limit(reviewsPerPage);

        const totalReviews = await Review.countDocuments({ productId });
        const totalPages = Math.ceil(totalReviews / reviewsPerPage);

        // Calculate rating breakdown
        const ratingBreakdown = await Review.aggregate([
            { $match: { productId: product._id } },
            { $group: { _id: "$rating", count: { $sum: 1 } } }
        ]);


        const ratings = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        ratingBreakdown.forEach(item => {
            ratings[item._id] = item.count;
        });

        // Calculate average rating
        const totalRating = Object.keys(ratings).reduce((sum, key) => sum + (ratings[key] * parseInt(key)), 0);
        const averageRating = totalReviews > 0 ? (totalRating / totalReviews).toFixed(1) : "No Reviews";

        res.render("product-details", {
            user: userData,
            product: product,
            products: products,
            quantity: product.quantity,
            totalOffer: totalOffer,
            category: findCategory,
            reviews: reviews,
            totalReviews,
            totalPages: totalPages,
            currentPage: page,
            reviewsPerPage: reviewsPerPage,
            ratings: ratings,
            averageRating: averageRating
        });

    } catch (error) {
        console.error("Error fetching product details:", error);
        res.status(500).json({ success: false, message: 'Failed to fetch product details.' });
    }
};


const getProductReviews = async (req, res) => {
    try {
        const productId = req.query.id;
        const page = parseInt(req.query.page) || 1;
        const reviewsPerPage = 5;
        
        const reviews = await Review.find({ productId })
            .populate('userId', 'name')
            .sort({ createdAt: -1 })
            .skip((page - 1) * reviewsPerPage)
            .limit(reviewsPerPage);
            
        const totalReviews = await Review.countDocuments({ productId });
        const totalPages = Math.ceil(totalReviews / reviewsPerPage);
        
        res.json({
            success: true,
            reviews: reviews,
            totalPages: totalPages,
            currentPage: page
        });
    } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).json({ success: false, message: 'Failed to fetch reviews.' });
    }
};

module.exports = {
    productDetails,
    getProductReviews
}
