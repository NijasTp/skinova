const mongoose = require('mongoose');
const {Schema} = mongoose;

const productSchema = new Schema({
    productName:{
        type: String,
        required: true
    },
    description:{
        type: String,
        required: true
    },
    fullDescription:{
        type: String,
        required:false
    },

    category: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Category',
        required: true
    },
    regularPrice:{
        type: Number,
        required: true
    },
    salePrice:{
        type: Number,
        required: true
    },
    productOffer:{
        type: Number,
        default: 0
    },
    validOffer:{
        type: Number,
        default:0
    },
    quantity:{
        type: Number,
        required: true
    },

    productImage:{
        type: [String],
        required: true
    },
    isBlocked:{
        type: Boolean,
        default: false
    },
    status:{
        type: String,
        enum:['available','out of stock','Discontinued'],
        required: true,
        default: 'available'
    },
},{timestamps: true})

const Product = mongoose.model('Product', productSchema);

module.exports = Product;