var express = require('express');
var router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client('147865379959-95uep5flk15e1f6eputi0lu4p4sjdqts.apps.googleusercontent.com');
const bcrypt = require('bcrypt');
const User = require('../models/userSchema.js'); // Import the User model
const userController=require('../controllers/user/userController');
const passport = require('passport');
const auth=require('../middleware/auth');
// router.get('/', function(req, res) {
//   res.render('home');
// });


/* GET home page. */
router.get('/login',userController.loadLogin);


router.get('/',userController.loadHome);

// Handle login form submission
router.post('/login', userController.login);





router.get('/signup', (req, res, next) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('user/signup',{error:''});
});



router.get('/signupotp', (req, res) => {
  res.render('user/signupotp');
});


router.post('/signup', userController.signup);

router.post('/verify-otp', userController.verifyOtp);

router.post('/logout', userController.logout);

router.post('/resend-otp', userController.resendOtp);

router.get('/auth/google',passport.authenticate('google', { scope: ['profile', 'email'] }))

router.get('/auth/google/callback',passport.authenticate('google', { failureRedirect: '/signup' }),(req,res)=>{
  res.redirect('/');
});

module.exports = router;
