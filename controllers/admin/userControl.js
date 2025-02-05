const User= require('../../models/userSchema')


const customerInfo = async (req, res) => {
    try {
        let search = '';
        if (req.query.search) {
            search = req.query.search;
        }

        let page = 1;
        if (req.query.page) {
            page = parseInt(req.query.page);
        }

        const limit = 3; // Number of users per page

        // Fetch user data with pagination and search
        const userData = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: '.*' + search + '.*', $options: 'i' } }, // Case-insensitive search
                { email: { $regex: '.*' + search + '.*', $options: 'i' } },
            ],
        })
            .limit(limit)
            .skip((page - 1) * limit)
            .exec();

        // Get the total count of users matching the search criteria
        const count = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: '.*' + search + '.*', $options: 'i' } },
                { email: { $regex: '.*' + search + '.*', $options: 'i' } },
            ],
        }).countDocuments();

        // Calculate total pages
        const totalPages = Math.ceil(count / limit);

        // Render the EJS template with the fetched data
        res.render('admin/users', {
            data: userData, // Pass user data
            currentPage: page, // Pass current page
            totalPages: totalPages, // Pass total pages
            search: search, // Pass search query
        });
    } catch (error) {
        console.log('Error while showing users:', error);
        res.redirect('/admin/pageNotFound');
    }
};
const userBlocked=async (req,res)=>{
    try {
        let id=req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:true}});
        res.redirect('/admin/users')
    } catch (error) {
        res.redirect('/admin/pageNotFound')
    }
}

const userUnblocked = async (req, res) => {
    try {
        let id = req.query.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.redirect('/admin/users');
    } catch (error) {
        console.error('Error unblocking user:', error);
        res.redirect('/admin/pageNotFound');
    }
};




module.exports={
    customerInfo,
    userBlocked,
    userUnblocked
    
}