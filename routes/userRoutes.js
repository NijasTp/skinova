const express = require('express');
const router = express.Router();
const passport = require('passport');
const  handleBase64Image  = require('../helpers/base64Image');
const userController = require('../controllers/user/userController');
const profileController = require("../controllers/user/profileController")
const productController = require("../controllers/user/productController")
const wishlistController= require("../controllers/user/wishlistController.js")
const checkoutController = require("../controllers/user/checkoutController")
const orderController = require("../controllers/user/orderController")
const paymentController = require ('../controllers/user/paymentController.js')
const walletController = require('../controllers/user/walletController.js')

const upload = require("../helpers/user-multer");
const { userAuth } = require('../middlewares/auth');
const {resetPasswordMiddleware,blockLoggedInUsers, checkBlockedUser} = require("../middlewares/profileAuth")


router.get('/pagenotfound', userController.pageNotFound);

router.get('/terms', (req, res) => {
    res.render('terms');
})


router.get('/signup', userController.loadSignUpPage);

router.post('/signup', userController.signUp);

router.post('/verify-otp', userController.verifyOtp);

router.post('/resend-otp', userController.resendOtp);

router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/signup' }), (req, res) => {
    req.session.user = req.user;
    res.redirect('/');
});


router.get('/login', userController.loadLoginPage);

router.post('/login', userController.login);

router.get('/',checkBlockedUser, userController.loadHomePage);

router.get('/home',(req,res) => res.redirect('/'))

router.get('/about',userController.loadAboutPage);

router.get('/contact',userController.loadContactPage);

router.get("/shop",userController.loadShoppingPage);
router.get('/filter', userController.filterProduct);



router.get("/productDetails",productController.productDetails)



router.get('/edit-profile',userController.loadEditProfilePage);
router.get('/profile',userAuth, userController.loadProfilePage);
router.post('/updateprofile' ,upload.single("profilePicture"), userController.updateProfile);
router.get('/change-password',userController.loadChangePasswordPage);
router.post('/update-password', userController.updatePassword);
router.post("/generate-email-otp", userController.generateEmailOTP);
router.post("/verify-email-otp", userController.verifyEmailOTP);



router.get('/addToCart', userController.addToCart)
router.get('/cart',userAuth, userController.loadCartPage)
router.get('/deleteFromCart',userController.deleteFromCart)
router.post('/update-quantity',userController.updateQuantity)
router.post('/send-password-otp',userController.sendPasswordOtp)


router.get('/wishlist',wishlistController.loadWishlist)
router.get('/addToWishlist',wishlistController.addToWishlist)
router.get('/removeFromWishlist',wishlistController.deleteFromWishlist)


router.get('/address',userAuth, userController.loadAddress);
router.get('/add-address',userAuth, userController.loadAddAddress);
router.post('/add-address',userAuth, userController.postAddAddress);
router.post('/set-primary-address',userController.setPrimaryAddress)
router.get("/editAddress",userController.editAddress);
router.post("/editAddress",userController.postEditAddress)
router.get("/deleteAddress",userController.deleteAddress)

router.get("/coupons", userController.loadCoupons);

router.get("/checkout",userAuth,checkoutController.loadCheckoutPage)

router.post('/place-order',userAuth,checkoutController.placeOrder)
router.get("/order-success", checkoutController.orderSuccess);
router.get("/order-failure",checkoutController.orderFailure);
router.post('/wallet-payment',userAuth,checkoutController.walletPayment)
router.get('/orders',userAuth,checkoutController.getOrders)
router.get('/order/:orderId', userAuth, orderController.orderDetails);
router.get("/download-invoice/:orderId", orderController.downloadInvoice);

//Coupons
router.post('/apply-coupon', orderController.applyCoupon)
router.get('/clear-coupons', orderController.clearCoupons)

//Return Order
router.post('/request-return',orderController.requestReturn)

//Payment
router.post('/create-razorpay-order',paymentController.createRazorpayOrder)
router.post('/verify-payment',paymentController.verifyPayment)

router.post('/cancel-order/:itemId', orderController.cancelOrder);  


//Wallet
router.get('/wallet',userAuth,walletController.loadWallet)
router.post("/wallet/add-money", walletController.addMoney);
router.post("/wallet/verify-payment", walletController.verifyPayment);


router.get('/logout', userController.logout);


router.get("/forgot-password",profileController.getForgotPassPage)
router.post("/forgot-email-valid",profileController.forgotEmailValid)
router.post("/verify-passForgot-otp",profileController.verifyForgotPassOtp)
router.get("/reset-password",resetPasswordMiddleware,profileController.getResetPassPage)
router.post("/resend-forgot-otp",blockLoggedInUsers,profileController.resendOtp);
router.post("/reset-password",resetPasswordMiddleware,profileController.postNewPassword);



module.exports = router;