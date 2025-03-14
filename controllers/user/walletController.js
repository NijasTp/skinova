const User = require('../../models/userSchema');
const env = require('dotenv').config();
const nodemailer = require('nodemailer');
const Wallet = require('../../models/walletSchema')
const Razorpay = require("razorpay");
const crypto = require("crypto");

const loadWallet = async (req, res) => {
    try {
        const userId = req.session.user; 
        let wallet = await Wallet.findOne({ userId });

        if (!wallet) {
            wallet = new Wallet({ userId });
            await wallet.save();
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 5; 
        const skip = (page - 1) * limit;

        const totalTransactions = wallet.transactions.length;
        const totalPages = Math.ceil(totalTransactions / limit);

        const transactions = wallet.transactions
            .sort((a, b) => b.date - a.date)
            .slice(skip, skip + limit);

        const totalCredit = wallet.transactions
            .filter(txn => txn.type === 'credit')
            .reduce((sum, txn) => sum + txn.amount, 0);

        const totalDebit = wallet.transactions
            .filter(txn => txn.type === 'debit')
            .reduce((sum, txn) => sum + txn.amount, 0);

        res.render('wallet', { 
            wallet, 
            transactions, 
            totalCredit, 
            totalDebit, 
            currentPage: page, 
            totalPages 
        });
    } catch (error) {
        console.error('Error loading wallet:', error);
        res.status(500).send('Internal Server Error');
    }
};


const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const addMoney = async (req, res) => {
    try {
        const userId = req.session.user;
        console.log("✅ Session User:", userId); // Debugging log

        const { amount } = req.body;
        console.log("✅ Received Amount:", amount); // Debugging log

        if (!userId) {
            console.log("❌ Error: User not authenticated");
            return res.status(401).json({ error: "User not authenticated" });
        }

        if (!amount || isNaN(amount) || amount <= 0) {
            console.log("❌ Error: Invalid amount");
            return res.status(400).json({ error: "Invalid amount" });
        }

        
        const amountInPaisa = amount * 100;

        
        const options = {
            amount: amountInPaisa,
            currency: "INR",
            receipt: `wallet_${userId.toString().slice(-6)}_${Date.now() % 1000000}`, 
            payment_capture: 1, 
        };
        

        const order = await razorpay.orders.create(options);
        console.log("✅ Razorpay Order Created:", order);

        return res.json({
            success: true,
            key: process.env.RAZORPAY_KEY_ID, // Send public key to frontend
            amount: order.amount,
            currency: order.currency,
            orderId: order.id
        });

    } catch (error) {
        console.error("❌ Error in /wallet/add-money:", error);
        return res.status(500).json({ error: "Internal Server Error", details: error?.message || "Unknown error" });
    }
};



const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const userId = req.session.user;

        // Verify signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            return res.json({ success: false, message: "Payment verification failed" });
        }

        // Fetch amount from Razorpay order
        const order = await razorpay.orders.fetch(razorpay_order_id);
        const amount = order.amount / 100; // Convert to rupees

        // Update wallet
        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = new Wallet({ userId });
        }

        wallet.balance += amount;
        wallet.transactions.push({
            type: "credit",
            amount,
            description: "Wallet recharge via Razorpay"
        });

        await wallet.save();

        res.json({ success: true });
    } catch (error) {
        console.error("Error verifying payment:", error);
        res.json({ success: false, message: "Error verifying payment" });
    }
};
module.exports ={
    loadWallet,
    addMoney,
    verifyPayment


}