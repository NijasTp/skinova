const User = require('../../models/userSchema');
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema")
const Cart = require("../../models/cartSchema")
const Wishlist= require('../../models/wishlistSchema')
const env = require('dotenv').config();
const nodemailer = require('nodemailer');
const mongoose= require('mongoose');
const bcrypt = require('bcrypt');
const fs=require('fs');
const path=require('path');
const sharp = require('sharp');
const { addCategory } = require('../admin/categoryController');
const Address = require('../../models/addressSchema');


const pageNotFound = async (req, res) => {
    try {
        res.render('page404')

    } catch (error) {
        res.redirect('/pagenotfound')
    }
}


const loadHomePage = async (req, res) => {
    try {
        const user = req.session.user;
        const categories = await Category.find({isListed:true})
        let productData = await Product.find({
            isBlocked:false,
            category:{$in:categories.map(category=>category._id)},
            quantity:{$gt:0},
        })

        productData.sort((a,b) => new Date(b.createdOn)-new Date(a.createdOn))
        productData = productData.slice(0,4);


        if(user){
            const userData = await User.findOne({_id:user});
            res.render('home',{user:userData, products:productData})
            
            
        } else{
            return res.render('home',{products:productData,req:req})
        }
            
        
    } catch (error) {
        console.log('Home Page Not Found')
        res.status(500).send('Server Error')
    }
}

const loadSignUpPage = async (req, res) => {
    try {
        res.render('signup')
    } catch (error) {
        console.log('Sign Up Page Not Found')
        res.status(500).send('Server Error')
    }
}






function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email,otp){
    try{
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        })

        const info = await transporter.sendMail({
            from: process.env.NODEMAIL_EMAIL,
            to: email,
            subject: 'OTP for Verification',
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP is ${otp}</b>`
        })

        return info.accepted.length > 0



    } catch (error) {
        console.error("Error for sending email",error)
        return false
    }
}



const signUp = async (req, res) => {
   
    try {
        const { name, email, phone, password, cPassword } = req.body
        
    

        const findUser = await User.findOne({email:email})

        if(findUser){
            return res.render('signup',{message:'User already exists'})
        }

        const otp = generateOTP()

        const emailSent = await sendVerificationEmail(email,otp);

        if(!emailSent){
            return res.json("email-error")
        }
        
        req.session.userOtp = otp;
        req.session.userData = {name,phone,email,password, cPassword};

        res.render('verify-otp');
        console.log("OTP Send",otp);
        

    } catch (error) {
        console.error('signup error',error)
        res.redirect('/pagenotfound')
    }
}

const securePassword = async (password) => {
    try {
        
        const passwordHash = await bcrypt.hash(password,10);

        return passwordHash;

    } catch (error) {
        
    }
}


const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;

        console.log('OTP from client:', otp);
        console.log('OTP in session:', req.session.userOtp);

        if (otp === req.session.userOtp) {
            const user = req.session.userData;
            const passwordHash = await securePassword(user.password);

            const saveUserData = new User({
                name: user.name,
                email: user.email,
                phone: user.phone,
                googleId: user.googleId || "",
                password: passwordHash
            });

            await saveUserData.save();
            req.session.user = saveUserData._id;

            res.json({ success: true, redirectUrl: '/' });
        } else {
            res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
        }
    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
}


const resendOtp = async (req, res) => {
    try {
        const { email } = req.session.userData;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email not found in session.' });
        }

        const otp = generateOTP();
        req.session.userOtp = otp;

        const emailSent = await sendVerificationEmail(email, otp);

        if (emailSent) {
            console.log("Resend OTP:", otp);
            res.status(200).json({ success: true, message: 'OTP Resent Successfully.' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to resend OTP. Please try again.' });
        }
    } catch (error) {
        console.error('Error Resending OTP:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error. Please try again.' });
    }
};

const loadLoginPage = async (req, res) => {
    try {
        if(!req.session.user){
            return res.render('login')
        } else{
            res.redirect('/')
        }
    } catch (error) {
        res.redirect('/pagenotfound')
    }
}


const login = async (req, res) => {
    try {
        
        const {email,password} = req.body;

        const findUser = await User.findOne({isAdmin:0,email:email});

        if(!findUser){
            return res.render('login',{message:'User not found'})
        }
        if(findUser.isBlocked){
            return res.render('login',{message:'User is Blocked by Admin'})
        }

        const passwordMatch = await bcrypt.compare(password,findUser.password);

        if(!passwordMatch){
            return res.render('login',{message:'Invalid Password'})
        }

        req.session.user = findUser._id;
        res.redirect('/')

    } catch (error) {

        console.error('Login Error',error);
        res.render('login',{message:'Login Failed Try again'})
        
        
    }
}


const logout = async (req, res) => {
    try {
        if (req.session.user) {
            delete req.session.user; // Remove only user session
        }
        res.redirect('/login'); // Redirect user to login page
    } catch (error) {
        console.log('Logout Error', error);
        res.redirect('/pagenotfound');
    }
};


// const loadShoppingPage = async (req,res) => {
//     try {

//         const user = req.session.user;
//         const userData = await User.findOne({_id:user});
//         const categories = await Category.find({isListed:true});

//         const categoriesWithCounts = await Promise.all(categories.map(async (category) => {
//             const count = await Product.countDocuments({ 
//                 category: category._id, 
//                 isBlocked: false, 
//                 quantity: { $gt: 0 } 
//             });
//             return { _id: category._id, name: category.name, productCount: count };
//         }));
    

//         const categoryIds = categories.map((category) => category._id.toString());
//         const page = parseInt(req.query.page) || 1;
//         const limit = 9;
//         const skip = (page-1)*limit;
//         const products = await Product.find({
//             isBlocked:false,
//             category:{$in:categoryIds},
//             quantity:{$gt:0},

//         }).sort({createdOn:-1}).skip(skip).limit(limit)

//         const totalProducts = await Product.countDocuments({
//             isBlocked:false,
//             category:{$in:categoryIds},
//             quantity:{$gt:0},

//         })

//         const totalPages = Math.ceil(totalProducts/limit);

//         // const brands = await Brand.find({isBlocked:false});

//         const categoriesWithIds = categories.map(category => ({_id:category._id,name:category.name}));

        
//         res.render("shop",{
//             user:userData,
//             products:products,
//             category:categoriesWithIds,
//             // brand:brands,
//             totalProducts:totalProducts,
//             currentPage:page,
//             totalPages:totalPages
//         })

//     } catch (error) {

//         res.redirect("/pageNotFound")
        
//     }
// }

const loadShoppingPage = async (req, res) => {
    try {
        // Get user data if authenticated
        const user = req.session.user;
        const userData = user ? await User.findOne({ _id: user }) : null;

        // Pagination setup
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;

        // Build query object
        let query = {
            isBlocked: false,
            quantity: { $gt: 0 }
        };

        // Add search functionality
        if (req.query.search) {
            query.productName = { $regex: req.query.search, $options: 'i' };
        }

        // Get categories and ensure they're listed
        const categories = await Category.find({ isListed: true });
        const categoryIds = categories.map(category => category._id);
        query.category = { $in: categoryIds };

        // Determine sort order
        let sort = {};
        switch (req.query.sort) {
            case 'popularity':
                sort = { popularity: -1 };
                break;
            case 'price_asc':
                sort = { salePrice: 1 };
                break;
            case 'price_desc':
                sort = { salePrice: -1 };
                break;
            case 'rating':
                sort = { averageRating: -1 };
                break;
            case 'featured':
                sort = { featured: -1 };
                break;
            case 'new':
                sort = { createdAt: -1 };
                break;
            case 'name_asc':
                sort = { productName: 1 };
                break;
            case 'name_desc':
                sort = { productName: -1 };
                break;
            default:
                sort = { createdAt: -1 }; 
        }


        const categoriesWithCounts = await Category.aggregate([
            {
                $match: { isListed: true }
            },
            {
                $lookup: {
                    from: 'products',
                    let: { categoryId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$category', '$$categoryId'] },
                                        { $eq: ['$isBlocked', false] },
                                        { $gt: ['$quantity', 0] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'products'
                }
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    productCount: { $size: '$products' }
                }
            }
        ]);


        const products = await Product.find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit);


        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

     
        res.render("shop", {
            user: userData,
            products: products,
            category: categoriesWithCounts,
            totalProducts: totalProducts,
            currentPage: page,
            totalPages: totalPages,
            search: req.query.search,
            sort: req.query.sort,
            req: req
        });

    } catch (error) {
        console.error("Error loading shopping page:", error);
        res.status(500).redirect("/pageNotFound");
    }
};


const filterProduct = async (req, res) => {
    try {
        const user = req.session.user;
        const category = req.query.category;
        const priceRange = req.query.price;

        console.log("Received Filters:", { category, priceRange }); // Debugging

        const findCategory = category ? await Category.findOne({ _id: category }) : null;

        const query = {
            isBlocked: false,
            quantity: { $gt: 0 }
        };

        if (findCategory) {
            query.category = findCategory._id;
        }

        if (priceRange) {
            const [minPrice, maxPrice] = priceRange.split('-').map(Number);
            console.log("Parsed Price Range:", { minPrice, maxPrice }); // Debugging
            query.price = { $gte: minPrice, $lte: maxPrice };
        }

        console.log("Final Query to DB:", query); // Debugging

        let findProducts = await Product.find(query).lean();
        console.log("Found Products:", findProducts); // Debugging

        findProducts.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));

        const categories = await Category.find({ isListed: true });

        const categoriesWithCounts = await Promise.all(categories.map(async (category) => {
            const count = await Product.countDocuments({
                category: category._id,
                isBlocked: false,
                quantity: { $gt: 0 }
            });
            return { _id: category._id, name: category.name, productCount: count };
        }));

        let itemsPerPage = 6;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(findProducts.length / itemsPerPage);
        const currentProduct = findProducts.slice(startIndex, endIndex);

        let userData = null;
        if (user) {
            userData = await User.findOne({ _id: user });
        }

        res.render("shop", {
            user: userData,
            products: currentProduct,
            category: categoriesWithCounts,
            totalPages,
            currentPage,
            selectedCategory: category || null,
            selectedPrice: priceRange || null
        });

    } catch (error) {
        console.error("Error in filtering:", error);
        res.redirect("/pageNotFound");
    }
};

const loadProfilePage= async (req, res) => {
    try {
        const user = req.session.user;
        const userData = await User.findOne({ _id: user });
        res.render("profile", { user: userData });
    } catch (error) {
        res.redirect("/pageNotFound");
    }
}



const loadEditProfilePage = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.redirect("/login");
        }
        const userData = await User.findOne({ _id: userId });

        if (!userData) {
            return res.render("edit-profile", { user: {} }); 
        }
        res.render("edit-profile", { user: userData });
    } catch (error) {
        console.error("Error loading profile:", error);
        res.redirect("/pageNotFound");
    }
};


const loadChangePasswordPage= async (req,res)=>{
    try {
        const user = req.session.user;
        const userData = await User.findOne({ _id: user });
        res.render("change-password");
    } catch (error) {
        res.redirect("/pageNotFound");
    }
}




const updateProfile = async (req, res) => {
    try {
        const { firstName, lastName, phone, username } = req.body;
        const userId = req.session.user; 

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized access" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }


        let imagePath = user.image; 
        if (req.file) {
            imagePath = "uploads/" + req.file.filename;
        }


        if (username && username !== user.name) {
            const existingUser = await User.findOne({ name: username });
            if (existingUser) {
                return res.status(400).json({ success: false, message: "Username already taken" });
            }
        }

    
        const updateData = {
            firstName: firstName || user.firstName,
            lastName: lastName || user.lastName,
            phone: phone || user.phone,
            name: username || user.name,
            image: imagePath 
        };

        await User.findByIdAndUpdate(userId, updateData, { new: true });

        return res.json({
            success: true,
            message: "Profile updated successfully!",
        });

    } catch (error) {
        console.error("Error updating profile:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};


  const sendPasswordOtp = async (req, res) => {
    try {
        const user = await User.findById(req.session.user); 
        if (!user) return res.json({ success: false, message: "User not found" });

        const otp = generateOTP(); 
        req.session.passwordOtp = otp; 
        req.session.passwordOtpEmail = user.email; 

        const emailSent = await sendVerificationEmail(user.email, otp);
        if (!emailSent) return res.json({ success: false, message: "Email sending failed" });

        res.json({ success: true });
    } catch (error) {
        console.error("Error sending OTP:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};


const verifyPasswordOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        if (otp !== req.session.passwordOtp) {
            return res.json({ success: false, message: "Invalid OTP" });
        }

        req.session.passwordOtpVerified = true; 
        res.json({ success: true });
    } catch (error) {
        console.error("Error verifying OTP:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

const updatePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword, confirmPassword } = req.body;
        const userId = req.session.user; 

        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

      
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Incorrect old password" });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: "Passwords do not match" });
        }

        
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({ 
                success: false, 
                message: "Password must be at least 8 characters long, include an uppercase letter, a lowercase letter, a number, and a special character." 
            });
        }

    
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.json({ success: true, message: "Password updated successfully" });
    } catch (error) {
        console.error("Error updating password:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const generateEmailOTP = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required." });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "Email is already in use." });
        }

        const otp = generateOTP();
        req.session.emailOtp = otp;
        req.session.newEmail = email;

        console.log("Generated OTP:", otp); 

        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return res.status(500).json({ success: false, message: "Failed to send OTP. Try again." });
        }

        res.status(200).json({ success: true, message: "OTP sent to your email." });
    } catch (error) {
        console.error("Error generating OTP:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
};


const verifyEmailOTP = async (req, res) => {
    try {
        const { otp } = req.body;
        if (!req.session.emailOtp || !req.session.newEmail) {
            return res.status(400).json({ success: false, message: "No OTP request found." });
        }

        if (otp !== req.session.emailOtp) {
            return res.status(400).json({ success: false, message: "Invalid OTP. Try again." });
        }

        const userId = req.session.user; 
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }

        await User.findByIdAndUpdate(userId, { email: req.session.newEmail });
        
       
        delete req.session.emailOtp;
        delete req.session.newEmail;

        res.status(200).json({ success: true, message: "Email updated successfully!" });
    } catch (error) {
        console.error("Error verifying OTP:", error);
        res.status(500).json({ success: false, message: "Server error. Try again." });
    }
};


const addToCart = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) return res.status(401).json({ success: false, message: "Please log in to add items to the cart" });

        const productId = req.query.id;
        const quantity = parseInt(req.query.quantity) || 1;
        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ success: false, message: "Product not found" });

        let cart = await Cart.findOne({ userId });

        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

        const itemIndex = cart.items.findIndex((item) => item.productId.equals(productId));
        const productPrice = Number(product.salePrice) || 0;

        if (itemIndex > -1) {
            cart.items[itemIndex].quantity += quantity;
            cart.items[itemIndex].totalPrice = cart.items[itemIndex].quantity * cart.items[itemIndex].price;
        } else {
            cart.items.push({
                productId,
                quantity: quantity,
                price: productPrice,
                totalPrice: quantity * productPrice,
                status: "placed",
                cancellationReason: "none"
            });
        }

        cart.cartTotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);
        await cart.save();

        
        await Wishlist.updateOne(
            { userId },
            { $pull: { products: { productId } } }
        );

        res.json({ success: true, message: "Product added to cart successfully!" });
    } catch (error) {
        console.error("Error adding to cart:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};



  const loadCartPage = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) return res.redirect("/login");

        const cart = await Cart.findOne({ userId }).populate("items.productId");

       
        if (!cart) {
            return res.render("cart", { cart: null, cartTotal: 0 });
        }

     
        if (cart.items.length === 0) {
            return res.render("cart", { cart, cartTotal: 0 }); 
        }

    
        res.render("cart", { cart, cartTotal: cart.cartTotal });
    } catch (error) {
        console.error("Error loading cart:", error);
        res.status(500).send("Internal Server Error");
    }
};

      const deleteFromCart = async (req, res) => {
        try {
          const userId = req.session.user;
          if (!userId) return res.redirect("/login");
      
          const productId = req.query.id; 
          if (!productId) return res.status('/pageNotFound').json({ message: "Product ID not provided" });
      
          const cart = await Cart.findOne({ userId });
          if (!cart) return res.status(404).json({ message: "Cart not found" });
      
          
          const itemIndex = cart.items.findIndex((item) => item.productId.equals(productId));
          if (itemIndex === -1) return res.status(404).json({ message: "Product not found in cart" });
      
          
          const deletedItem = cart.items.splice(itemIndex, 1)[0];
      
          
          cart.cartTotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);
      
          
          await cart.save();
      
          res.redirect("/cart"); 
        } catch (error) {
          console.error("Error deleting item from cart:", error);
          res.status(500).send("Internal Server Error");
        }
      };


      const updateQuantity = async (req, res) => {
        try {
            const userId = req.session.user;
            if (!userId) return res.status(401).json({ success: false, message: "Login required" });
    
            const { id, change } = req.query;
            const changeValue = Number(change);
    
            let cart = await Cart.findOne({ userId }).populate("items.productId");
    
            if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });
    
            const itemIndex = cart.items.findIndex((item) => item.productId._id.equals(id));
    
            if (itemIndex === -1) return res.status(404).json({ success: false, message: "Product not in cart" });
    
            let item = cart.items[itemIndex];
    
            let newQuantity = item.quantity + changeValue;
    
            let productStock = item.productId.quantity;
    
            if (newQuantity > 5) {
                return res.json({ success: false, message: "User limit exceeded for this product" });
            }
    
            if (newQuantity > productStock) {
                return res.json({ success: false, message: `Only ${productStock} items available in stock.` });
            }
    
            if (newQuantity < 1) {
                return res.json({ success: false, message: "Minimum quantity is 1" });
            }
    
            item.quantity = newQuantity;
            item.totalPrice = item.quantity * item.productId.salePrice;
    
            cart.cartTotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);
    
            await cart.save();
    
            res.json({
                success: true,
                newQuantity: item.quantity,
                salePrice: item.productId.salePrice,
                cartTotal: cart.cartTotal,
            });
        } catch (error) {
            console.error("Error updating quantity:", error);
            res.status(500).json({ success: false, message: "Internal Server Error" });
        }
    };
    
    
    
    const loadAddress = async (req, res) => {
        try {
            const userId = req.session.user;
            if (!userId) return res.redirect("/login");
    
            // Fetch cart data
            const cart = await Cart.findOne({ userId });
    
            // Fetch user addresses
            const addresses = await Address.find({ userId });
    
            res.render("address", { cart, addresses,userId });
        } catch (error) {
            console.error("Error loading address:", error);
            res.status(500).send("Internal Server Error");
        }
    };
    
 const loadAddAddress = async (req,res) =>{
    try {
        const userId = req.session.user;
        if (!userId) return res.redirect("/login");
    
        // Fetch cart data
        const cart = await Cart.findOne({ userId });
    
        res.render("add-address", { cart });
    } catch (error) {
        console.error("Error loading add address:", error);
        res.status(500).send("Internal Server Error");
    }
 }   
   
 const setPrimaryAddress = async (req, res) => {
    try {
        const { userId, addressId } = req.body;

        // Find user’s address document
        const addressDoc = await Address.findOne({ userId });

        if (!addressDoc) return res.status(404).json({ message: "Address not found" });

        // Set all addresses to not primary
        addressDoc.address.forEach(addr => addr.isPrimary = false);

        // Set selected address to primary
        const selectedAddress = addressDoc.address.find(addr => addr._id.toString() === addressId);
        if (selectedAddress) selectedAddress.isPrimary = true;

        await addressDoc.save();

        res.json({ success: true, message: "Primary address updated" });
    } catch (error) {
        console.error("Error updating primary address:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

 
 const postAddAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        console.log("Session User ID:", userId);  // Debugging

        const { name, country, city, state, streetAddress, pincode, phone, altPhone } = req.body;

        if (!userId) {
            console.error("User not logged in!");
            return res.redirect("/login");
        }

        // Find if user already has an address entry
        let addressEntry = await Address.findOne({ userId });

        if (!addressEntry) {
            // If no address entry exists, create a new one
            addressEntry = new Address({ userId, address: [] });
        }

        // Add new address to the existing entry
        addressEntry.address.push({
            name,
            country,
            city,
            state,
            streetAddress,
            pincode,
            phone,
            altPhone
        });

        await addressEntry.save();
        console.log("Address added successfully!");
        res.redirect("/address");

    } catch (error) {
        console.error("Error adding address:", error.message);
        res.status(500).send("Internal Server Error: " + error.message);
    }
};


const editAddress = async (req,res) => {
    try {
        
        const addressId = req.query.id;
        const user = req.session.user;
        const currAddress = await Address.findOne({
            "address._id":addressId,

        });
        if(!currAddress){
            return res.redirect("/pageNotFound")
        }

        const addressData = currAddress.address.find((item) => {
            return item._id.toString() === addressId.toString();

        })

        if(!addressData){
            return res.redirect("/pageNotFound")
        }

        res.render("edit-address",{
            address:addressData,
            user:user
        })

    } catch (error) {

        console.error("Error in edit Address",error)
        res.redirect("/pageNotFound")
        
    }
}

const postEditAddress = async (req,res) => {
    try {

        const data = req.body;
        const addressId = req.query.id;
        const user = req.session.user;
        const findAddress = await Address.findOne({
            "address._id":addressId
        });
        if(!findAddress){
            res.redirect("/pageNotFound")
        }
        await Address.updateOne(
            {"address._id":addressId},
            {$set:{
                "address.$":{
                    _id:addressId,
                    name:data.name,
                    country:data.country,
                    city:data.city,
                    state:data.state,
                    streetAddress:data.streetAddress,
                    pincode:data.pincode,
                    phone:data.phone,
                    altPhone:data.altPhone
                }
            }}
        )

        res.redirect("/address")
        
    } catch (error) {

        console.error("Error in editing address",error)
        res.redirect("/pageNotFound")
        
    }
}


const deleteAddress = async (req, res) => {
    try {
        const userId = req.session.user;  
        const addressId = req.query.id;  // Ensure this is the address _id, NOT the document _id

        if (!userId) {
            return res.status(401).send("Unauthorized, please log in again");
        }

        if (!mongoose.Types.ObjectId.isValid(addressId)) {
            return res.status(400).send("Invalid Address ID");
        }

        console.log("User ID:", userId);
        console.log("Address ID:", addressId);

        const objectId = new mongoose.Types.ObjectId(addressId);

        // ✅ Find the address correctly
        const findAddress = await Address.findOne({ 
            userId: userId, 
            "address._id": objectId  // Ensure we're looking in the array
        });

        console.log("Find Address Result:", findAddress);

        if (!findAddress) {
            return res.status(404).send("Address Not Found");
        }

        // ✅ Remove the specific address from the array
        const updateResult = await Address.updateOne(
            { userId: userId },  
            { $pull: { address: { _id: objectId } } }
        );

        console.log("Update Result:", updateResult);

        if (updateResult.modifiedCount === 0) {
            return res.status(500).send("Failed to delete address");
        }

        res.redirect("/address");

    } catch (error) {
        console.error("Error in deleting address:", error);
        res.redirect("/pageNotFound");
    }
};





module.exports = {
    loadHomePage,
    pageNotFound,
    loadLoginPage,
    loadSignUpPage,
    signUp,
    login,
    verifyOtp,
    resendOtp,
    logout,
    loadShoppingPage,
    filterProduct,
    loadProfilePage,
    updateProfile,
    addCategory,
    addToCart,
    loadCartPage,
    deleteFromCart,
    updateQuantity,
    loadEditProfilePage,
    loadChangePasswordPage,
    sendPasswordOtp,
    verifyPasswordOtp,
    updatePassword,
    loadAddress,
    loadAddAddress,
    postAddAddress,
    setPrimaryAddress,
    editAddress,
    postEditAddress,
    deleteAddress,
    generateEmailOTP,
    verifyEmailOTP



    
}