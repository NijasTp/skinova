const Review = require('../../models/reviewSchema'); 

const addReview = async (req, res) => {
    try {
        const { productId, rating, text } = req.body;
        const userId = req.session.user; 

        const newReview = new Review({
            productId,
            userId,
            rating,
            reviewText: text
        });

        await newReview.save();
        res.json({ success: true, message: 'Review submitted successfully!' });
    } catch (error) {
        console.error("Error submitting review", error);
        res.status(500).json({ success: false, message: 'Failed to submit review.' });
    }
}

const deleteReview = async (req, res) => {
    try {
        const { reviewId } = req.query;
        console.log("Review ID:", reviewId);
        const user = req.session.user;

        if (!user) {
            return res.status(403).json({ success: false, message: 'User not authenticated.' });
        }

        const review = await Review.findById(reviewId);
        if (!review) {
            return res.status(404).json({ success: false, message: 'Review not found.' });
        }

        // Normalize user ID
        const userId = user._id ? user._id.toString() : user; 

        console.log('review by', review.userId);
        console.log('user id', userId);

        if (review.userId.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'You are not authorized to delete this review.' });
        }

        await Review.findByIdAndDelete(reviewId);

        // Get the updated total number of reviews
        const totalReviews = await Review.countDocuments({ productId: review.productId });

        res.json({ success: true, message: 'Review deleted successfully.', totalReviews });
    } catch (error) {
        console.error("Error deleting review", error);
        res.status(500).json({ success: false, message: 'Failed to delete review.' });
    }
};


module.exports = {
    addReview,
    deleteReview

};