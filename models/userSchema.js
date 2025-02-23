const mongoose = require('mongoose');
const {Schema} = mongoose;

const userSchema = new Schema({
    firstName:{
        type: String,
        required: false
    },
    lastName:{
        type: String,
        required: false
    },
    name:{
        type: String,
        required: false
    },
    email:{
        type: String,
        required: true,
        unique: true
    },
    phone:{
        type: String,
        required: false,
        unique: false,
        sparse: true,
        default: null
    },
    googleId:{
        type: String,
        default: "",
    },
    password:{
        type: String,
        required: false,
    },
    isBlocked:{
        type: Boolean,
        default: false     
    },
    isAdmin:{
        type: Boolean,
        default: false     
    },
    image:{
        type: String,
        required: false,
        default: null
    },
    cart:[{
        productId: {
            type: Schema.Types.ObjectId,
            ref: 'Product'
        },
        quantity: {
            type: Number,
            default: 1
        }
    }],
    wallet:{
        type: Number,
        default: 0
    },
    wishlist:[{
        type: Schema.Types.ObjectId,
        ref: 'Wishlist'
    }],
    orderHistory:[{
        type: Schema.Types.ObjectId,
        ref: 'Order'
    }],
    createdOn:{
        type: Date,
        default: Date.now
    },
    referalCode:{
        type: String,
        
    },
    redeemed:{
        type: Boolean,
        
    },
    redeemedUsers:[{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    searchHistory:[{
        category:{
            type: Schema.Types.ObjectId,
            ref: 'Category'
        },
        brand:{
            type: String
        },
        searchOn:{
            type: Date,
            default: Date.now
        }
    }]

})

const User = mongoose.model('User', userSchema);

module.exports = User;