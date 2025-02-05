var express = require('express');
var router = express.Router();
const adminController=require('../controllers/admin/adminController');
const {userAuth, adminAuth}= require('../middleware/auth')
const userControl=require('../controllers/admin/userControl')
const categoryController=require('../controllers/admin/categoryController')
/* Error Management */
router.get('/pageNotFound',adminController.pageerror)
//Login Management//
router.get('/login', adminController.loadLogin);
router.post('/login', adminController.login);
router.get('/dashboard',adminAuth,adminController.loadDashboard);
router.post('/logout',adminController.logout)

//user control management
router.get('/users',adminAuth,userControl.customerInfo)
router.get('/blockUser',adminAuth,userControl.userBlocked)
router.get('/unblockUser',adminAuth,userControl.userUnblocked)
//category
router.get('/categories',adminAuth,categoryController.categoryInfo)
router.get('/addCategory',adminAuth,categoryController.loadAddCategory)
router.post('/addCategory',adminAuth,categoryController.addCategory)
router.post('/addCategoryOffer',adminAuth,categoryController.addCategoryOffer)
router.post('/removeCategoryOffer',adminAuth,categoryController.removeCategoryOffer)
router.get('/listCategory',adminAuth,categoryController.getListCategory)
router.get('/unlistCategory',adminAuth,categoryController.getUnlistCategory)
router.get('/editCategory', adminAuth, categoryController.getEditCategory);
router.post('/editCategory/:id',adminAuth,categoryController.editCategory)









module.exports = router;
