const express = require('express');
const router = express.Router();
const passport = require('passport');
const userController = require('../controllers/user/userController');
const profileController = require("../controllers/user/profileController")
const productController = require("../controllers/user/productController")
const wishlistController= require("../controllers/user/wishlistController.js")
const checkoutController = require("../controllers/user/checkoutController")
const orderController = require("../controllers/user/orderController")


const upload = require("../helpers/user-multer");
const { userAuth } = require('../middlewares/auth');
const {resetPasswordMiddleware,blockLoggedInUsers, checkBlockedUser} = require("../middlewares/profileAuth")


router.get('/pagenotfound', userController.pageNotFound);


router.get('/signup', userController.loadSignUpPage);

router.post('/signup', userController.signUp);

router.post('/verify-otp', userController.verifyOtp);

router.post('/resend-otp', userController.resendOtp);

router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/signup' }), (req, res) => {
    res.redirect('/');
});

router.get('/login', userController.loadLoginPage);

router.post('/login', userController.login);

router.get('/',checkBlockedUser, userController.loadHomePage);

router.get("/shop",userController.loadShoppingPage);
router.get('/filter', userController.filterProduct);



router.get("/productDetails",productController.productDetails)



router.get('/edit-profile',userController.loadEditProfilePage);
router.get('/profile',userAuth, userController.loadProfilePage);
router.post('/updateprofile', upload.single("profilePicture"), userController.updateProfile);
router.get('/change-password',userController.loadChangePasswordPage);
router.post('/update-password', userController.updatePassword);
router.post("/generate-email-otp", userController.generateEmailOTP);
router.post("/verify-email-otp", userController.verifyEmailOTP);



router.get('/addToCart',userAuth, userController.addToCart)
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
router.get("/editAddress",userController.editAddress);
router.post("/editAddress",userController.postEditAddress)
router.get("/deleteAddress",userController.deleteAddress)


router.get("/checkout",userAuth,checkoutController.loadCheckoutPage)

router.post('/place-order',userAuth,checkoutController.placeOrder)
router.get('/orders',userAuth,checkoutController.getOrders)
router.get('/order-details',userAuth)

router.post('/cancel-order/:itemId', orderController.cancelOrder);  

module.exports = router;


router.get('/logout', userController.logout);


router.get("/forgot-password",profileController.getForgotPassPage)
router.post("/forgot-email-valid",profileController.forgotEmailValid)
router.post("/verify-passForgot-otp",profileController.verifyForgotPassOtp)
router.get("/reset-password",resetPasswordMiddleware,profileController.getResetPassPage)
router.post("/resend-forgot-otp",blockLoggedInUsers,profileController.resendOtp);
router.post("/reset-password",resetPasswordMiddleware,profileController.postNewPassword);




module.exports = router;