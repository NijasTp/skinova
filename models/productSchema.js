const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    productName: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    regularPrice: {
        type: Number,
        required: true,
        min: 0
    },
    salePrice: {
        type: Number,
        required: true,
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    productOffer:{
        type: Number,
        default: 0
    },
    stock: {
        type: Number,
        required: true,
        min: 0
    },
    skinType: {
        type: String,
        required: true,
    },
    typeStock: {
        type: String,
    },
    productImage: {
        type: [String],
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum:['active','out of stock','discontinued'],
        default: 'active'
    },
},{timestamps:true});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;