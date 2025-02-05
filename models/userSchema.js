const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        sparse: true,
        default: null
    },
    password: {
        type: String,
        required: false
    },
    phone:{
        type:String,
        required:false,
        unique:true,
        // sparse:true,
        default:null
    },
    googleId:{
        type:String,
        unique:true,
        sparse:true
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    isAdmin:{
        type:Boolean,
        default:false
    },
    cart:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cart'
    }],
    wallet:{
        type:Number,
        default:0
    },
    wishlist:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Wishlist'
    }],
    orderHistory:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    referalCode:{
        type:String,
    },
    redeemed:{
        type:Boolean,
    },
    redeemedUsers:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    },
    searchHistory:[{
        category:{
            type:mongoose.Schema.Types.ObjectId,
            ref:'Category'
        },
        brand:{
            type:String
        },
        searchOn:{
            type:Date,
            default:Date.now
        }
    }]
});

const User = mongoose.model('User', userSchema);

module.exports = User;
