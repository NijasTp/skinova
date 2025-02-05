const User = require('../../models/userSchema');
const nodemailer = require('nodemailer');
const env = require('dotenv').config();
const bcrypt = require('bcrypt');

let generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

let sendEmail = async (email, otp) => {
   try {
       const transporter = nodemailer.createTransport({
           service: 'gmail',
           port: 587,
           secure: false,
           requireTLS: true,
           auth: {
               user: process.env.EMAIL,
               pass: process.env.PASSWORD
           }
       });
       const mailOptions = {
           from: process.env.EMAIL,
           to: email,
           subject: 'Signup OTP',
           text: `Your OTP is ${otp}`,
           html: `Your OTP is <b>${otp}</b>`
       };
       const info = await transporter.sendMail(mailOptions);
       return info.accepted.length > 0;

   } catch (error) {
       console.error('Error sending email:', error);
       return false;
   }
}
const loadLogin = (req, res) => {
    try {
        if (req.session.user) {
            return res.redirect('/');
        }
        res.render('user/login', { message: '' }); // Pass an empty message or a default value
    } catch (error) {
        console.error('Error during login:', error);
        res.redirect('/pageNotFound');
    }
};

const loadHome =async (req, res) => {
 try {
    const user=req.session.user;
    if (user) {
        const userData=await User.findById(user);
         res.render('user/home',{user:userData});
    }else{
        return res.render('user/home');
    }
    return res.render('user/home');
 } catch (error) {
    console.error('Error during login:', error);
    res.redirect('/pageNotFound');
 }
};

const login = async (req, res) => {
    try {
      const { email, password } = req.body;
      const findUser = await User.findOne({ isAdmin: 0, email: email });
      
      if (!findUser) {
        return res.render('user/login', { message: 'Invalid email or password' });
      }
  
      if (findUser.isBlocked) {
        return res.render('user/login', { message: 'User is blocked' });
      }
  
      const passwordMatch = await bcrypt.compare(password, findUser.password);
      if (!passwordMatch) {
        return res.render('user/login', { message: 'Invalid password' });
      }
  
      req.session.user = findUser._id;
      return res.redirect('/');
  
    } catch (error) {
      console.error('Error during login:', error);
      return res.render('user/login', { message: '' }); // Default empty message when there's no error
    }
  };
  


const signup= async (req, res) => {
    
    try {
        const {name, email, password} = req.body;
        
        const findUser=await User.findOne({email});

        if (findUser) {
            return res.render('user/signup', { error: 'Email already in use' });
        }
        //either set a res.render('signupotp') to render the otp page then send the otp to the email

        const otp=generateOTP();
    
        const emailSent=await sendEmail(email, otp);
       if (!emailSent) {
           return res.render('user/signup', { error: 'An error occurred sending the OTP' });
         }
     
         req.session.userOtp = otp;
         req.session.userData = {name, email, password };
         console.log(req.session.userData);
        res.render('user/otpverify');
    
    
    
    } catch (error) {
        console.error('Error during signup:', error);
        res.redirect('/pageNotFound');
    }
};

const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;

        if (otp === req.session.userOtp) {
            const user = req.session.userData;
            const passwordHash = await bcrypt.hash(user.password, 10);

            const saveUserData = new User({
                name: user.name,
                email: user.email,
                password: passwordHash
            });

            await saveUserData.save();
            req.session.user = saveUserData;
            // Ensure JSON response is sent
            return res.json({ success: true, redirectUrl: "/" });
        } else {
            return res.status(400).json({ success: false, message: "Invalid OTP" });
        }
    } catch (error) {
        console.error("Error during signup:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
const logout = (req, res) => {
try {
    req.session.destroy((err) => {
        if (err) {
            console.error("Logout Error:", err);
            return res.status(500).json({ success: false, message: "Logout failed" });
        }
        res.redirect("/login"); 
    });
} catch (error) {
    console.error('Error during logout:', error);
    res.redirect('/pageNotFound');
}
};

const resendOtp = async (req, res) => {
    try {
        const otp = generateOTP();
        const emailSent = await sendEmail(req.session.userData.email, otp);

        if (!emailSent) {
            return res.status(500).json({ success: false, message: "An error occurred sending the OTP" });
        }

        req.session.userOtp = otp;
        console.log(otp);
        
        return res.json({ success: true });
    } catch (error) {
        console.error("Error resending OTP:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

module.exports = { 
    signup,
    verifyOtp,
    logout,
    resendOtp,
    loadLogin,
    login,
    loadHome
};