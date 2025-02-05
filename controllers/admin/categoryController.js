const Category = require('../../models/categorySchema')
const Product = require('../../models/productSchema')

const categoryInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;

        const categoryData = await Category.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalCategories = await Category.countDocuments();
        const totalPages = Math.ceil(totalCategories / limit);
        res.render('admin/categories', {
            cat: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories
        })
    } catch (error) {
        console.error(error);
        res.redirect('/admin/pageNotFound')
    }
}

const addCategory = async (req, res) => {
    const { name, description } = req.body;
    try {

        const existingCategory = await Category.findOne({ name })

        if (existingCategory) {
            return res.status(400).json({ error: 'Category already exists' })
        }
        const newCategory = new Category({
            name,
            description,
        })
        await newCategory.save();
        return res.json({ message: 'Category added successfully' })

    } catch (error) {
        return res.status(500).json({ error: 'Internal Server Error' })
    }
}
const loadAddCategory = (req, res) => {
    return res.render('admin/addCategory')
}

const addCategoryOffer = async (req, res) => {
    try {
        const { categoryId, percentage } = req.body
        const category = await Category.findById(categoryId)
        if (!category) {
            return res.status(404).json({ status: false, message: "Category not found" })
        }
        if (isNaN(percentage) || percentage < 0 || percentage > 99) {
            return res.json({ status: false, message: "Invalid percentage value" })
        }
        await Category.updateOne({ _id: categoryId }, { $set: { categoryOffer: percentage } })
        res.json({ status: true, message: "Offer added successfully" })
    } catch (error) {
        console.error("Error in addCategoryOffer:", error)
        return res.status(500).json({ status: false, message: "Internal Server Error" })
    }
}

const removeCategoryOffer = async (req, res) => {
    try {
        const categoryId = req.body.categoryId
        const category = await Category.findById(categoryId)
        if (!category) {
            return res.status(404).json({ status: false, message: "Category not found" })
        }
        await Category.updateOne({ _id: categoryId }, { $set: { categoryOffer: null } })
        const products = await Product.find({ category: category._id })
        for (const product of products) {
            product.productOffer = 0
            product.salePrice = product.regularPrice
            await product.save()
        }
        res.json({ status: true, message: "Offer removed successfully" })
    } catch (error) {
        console.error("Error in removeCategoryOffer:", error)
        return res.status(500).json({ status: false, message: "Internal Server Error" })
    }
}

const getListCategory = async (req, res) => {
    try {
        let id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: false } })
        res.redirect('/admin/categories')
    } catch (error) {
        res.redirect('/admin/pageNotFound')
    }
}

const getUnlistCategory = async (req, res) => {
    try {
        let id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: true } });
        res.redirect('/admin/categories');
    } catch (error) {
        res.redirect('/admin/pageNotFound');
    }
}

const getEditCategory=async (req,res)=>{
    try {
        const id = req.query.id;
        const category = await Category.findById(id);
        res.render('admin/editCategory',{category:category})
    } catch (error) {
        res.redirect('/admin/pageNotFound')
    }
}

const editCategory=async (req,res)=>{
    try {
        const id= req.params.id;
        const {categoryname,description}=req.body;
        const existingCategory = await Category.findOne({
            name: categoryname,
            _id: { $ne: id } 
        });
        

        if (existingCategory){
            return res.json({error:'category exists, please choose another name'})
        }


        const updateCategory= await Category.findByIdAndUpdate(id,{
            name:categoryname,
            description:description,
        },{new:true})

        if (updateCategory){
            res.redirect('/admin/categories')
        }else{
            res.json({error:'Category not found'})
        }
    } catch (error) {
        res.json({error:'Internal server error'})

    }
}

module.exports = {
    categoryInfo,
    addCategory,
    loadAddCategory,
    addCategoryOffer,
    removeCategoryOffer,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    editCategory
}