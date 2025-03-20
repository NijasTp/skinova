const Review = require('../../models/reviewSchema'); 
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');


const getReviews = async (req, res) => {
    const { search, rating, page = 1, limit = 10 } = req.query; // Accessing from req.query
    const query = {};

    console.log('Received query parameters:', { search, rating, page, limit }); // Debugging line

    if (search) {
        query.$or = [
            { 'productId': { $in: await Product.find({ productName: { $regex: search, $options: 'i' } }).distinct('_id') } },
            { 'userId': { $in: await User.find({ name: { $regex: search, $options: 'i' } }).distinct('_id') } }
        ];
        console.log('Constructed query for search:', query); // Debugging line
    }

    if (rating) {
        query.rating = rating;
        console.log('Constructed query for rating:', query); // Debugging line
    }

    try {
        const reviews = await Review.find(query)
            .populate('productId', 'productName')
            .populate('userId', 'name')
            .limit(limit)
            .skip((page - 1) * limit);

        console.log('Fetched reviews:', reviews); // Debugging line

        const totalReviews = await Review.countDocuments(query);
        const hasNextPage = totalReviews > page * limit;
        const hasPrevPage = page > 1;
        const nextPage = hasNextPage ? parseInt(page) + 1 : null;
        const prevPage = hasPrevPage ? parseInt(page) - 1 : null;

        res.render('admin-reviews', {
            reviews,
            hasNextPage,
            hasPrevPage,
            nextPage,
            prevPage
        });
    } catch (error) {
        console.error('Error fetching reviews:', error); // Debugging line
        res.status(500).send('Server Error');
    }
};


//delete a review

const deleteReview = async (req, res) => {
    try {
        await Review.findByIdAndDelete(req.params.id);
        res.redirect('/admin/reviews');
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

module.exports = {
    getReviews,
    deleteReview,
    

}
