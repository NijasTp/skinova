


const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const customerController = require('../controllers/admin/customerController');
const categoryController = require('../controllers/admin/categoryController');
const productController = require('../controllers/admin/productController');
const transactionController = require('../controllers/admin/transactionController');
const reviewController = require('../controllers/admin/reviewController')
const { adminAuth } = require('../middlewares/auth');
const multer = require("multer");
const upload = multer();

router.get('/pageerror', adminController.pageError);
router.get('/login', adminController.loadLogin);
router.post('/login', adminController.login);
router.get('/', adminAuth, adminController.loadDashboard);
router.get('/download-sold-products', adminAuth, adminController.downloadSoldProducts);
router.get('/logout', adminController.logout);

router.get('/users', adminAuth, customerController.customerInfo);
router.get('/blockCustomer', adminAuth, customerController.customerBlocked);
router.get('/unBlockCustomer', adminAuth, customerController.customerUnblocked);

router.get('/category', adminAuth, categoryController.categoryInfo);
router.post('/addCategory', adminAuth, categoryController.addCategory);
router.post('/addCategoryOffer', adminAuth, categoryController.addCategoryOffer);
router.post('/removeCategoryOffer', adminAuth, categoryController.removeCategoryOffer);
router.post("/editCategoryOffer", adminAuth, categoryController.editCategoryOffer)
router.get('/listCategory', adminAuth, categoryController.getListCategory);
router.get('/unListCategory', adminAuth, categoryController.getUnlistCategory);
router.get('/editCategory', adminAuth, categoryController.getEditCategory);
router.post('/editCategory/:id', adminAuth, categoryController.editCategory);

router.delete("/deleteCategory/:id", adminAuth, categoryController.deleteCategory)

router.get("/addProducts", adminAuth, productController.getProductAddPage);
router.post("/saveImage", adminAuth, upload.single('image'), productController.saveImage);
router.post("/addProducts", adminAuth, upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 }
]), productController.addProducts);


router.get("/products",adminAuth,productController.getAllProducts);
router.post("/addProductOffer",adminAuth,productController.addProductOffer);
router.post("/removeProductOffer",adminAuth,productController.removeProductOffer);

router.get('/reviews',adminAuth,reviewController.getReviews)
router.post('/reviews/:id',adminAuth,reviewController.deleteReview)

router.get("/blockProduct",adminAuth,productController.blockProduct);
router.get("/unblockProduct",adminAuth,productController.unblockProduct);

router.get("/editProduct",adminAuth,productController.getEditProduct)
router.post("/editProduct/:id", adminAuth, upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 }
]), productController.editProduct);
router.post("/deleteImage",adminAuth,productController.deleteSingleImage)

router.get('/deleteProduct',adminAuth,productController.deleteProduct);


router.get('/orders', adminAuth, productController.getOrders);
router.get('/orders/:orderId', adminAuth, productController.getOrderDetails);
router.post('/orders/update-status', adminAuth, productController.updateOrderStatus);
router.post('/orders/cancel', adminAuth,productController.cancelOrder);
router.post('/orders/approve-return', productController.approveReturn);
router.post('/orders/reject-return', productController.rejectReturn);

//Coupons
router.get('/coupon', adminAuth, productController.getCoupons);
router.get('/add-coupon', adminAuth, productController.getCouponAddPage);
router.post('/add-coupon', adminAuth, productController.addCoupon);
router.get("/edit-coupon/:id",adminAuth,productController.getEditCoupon)
router.post("/edit-coupon/:id",adminAuth,productController.editCoupon)

router.get("/delete-coupon/:id", productController.deleteCoupon);

//Transactions
router.get('/transactions', adminAuth, transactionController.getTransactions);



module.exports = router;
