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
const Wallet = require('../../models/walletSchema')

const loadWallet = async (req, res) => {
    try {
        const userId = req.session.user; 
        let wallet = await Wallet.findOne({ userId });

        if (!wallet) {
            wallet = new Wallet({ userId });
            await wallet.save();
        }

        // Calculate total credit and debit
        const totalCredit = wallet.transactions
            .filter(txn => txn.type === 'credit')
            .reduce((sum, txn) => sum + txn.amount, 0);

        const totalDebit = wallet.transactions
            .filter(txn => txn.type === 'debit')
            .reduce((sum, txn) => sum + txn.amount, 0);

        res.render('wallet', { wallet, totalCredit, totalDebit });
    } catch (error) {
        console.error('Error loading wallet:', error);
        res.status(500).send('Internal Server Error');
    }
};

module.exports ={
    loadWallet,

}