const User = require('../../models/userSchema'); 
const bcrypt = require('bcrypt');

const pageerror= async (req,res)=>{
    res.render('admin/pageNotFound')
}

const loadLogin= (req, res) => {
    try {
        if (req.session.admin) {
            return res.redirect('/admin/dashboard');
        }
        res.render('admin/login',{errorMessage:''});
    } catch (error) {
        console.error('Error during login:', error);
        res.redirect('/admin/pageNotFound');
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await User.findOne({ email: email, isAdmin: true }); // ✅ Fix: Added 'await'

        if (!admin) {
            return res.render('admin/login', { errorMessage: 'Invalid email or password' }); // ✅ Fix: Show error
        }

        const passwordMatch = await bcrypt.compare(password, admin.password);
        if (!passwordMatch) {
            return res.render('admin/login', { errorMessage: 'Invalid email or password' }); // ✅ Fix: Show error
        }

        req.session.admin = admin; 
        return res.redirect('/admin/dashboard');

    } catch (error) {
        console.error('Error during login:', error);
        res.redirect('/admin/pageNotFound');
    }
};


const loadDashboard = (req, res) => {  
    try {
        if (req.session.admin){
            return res.render('admin/dashboard'); 
        }
        return res.render('admin/login')
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.redirect('/admin/pageNotFound');
    }   
};

const logout=async (req,res)=>{
try {
    req.session.destroy(err=>{
        if (err){
            console.log('Error in destroying session',err)
            return res.redirect('/admin/pageNotFound')
        }
        res.redirect('/admin/login')
    })
} catch (error) {
console.log('unexpected error in logout',error);
    res.redirect('/admin/pageNotFound')
}
}



module.exports={
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout
}