const mongoose = require('mongoose');
const {v4: uuidv4} = require('uuid');
const Address = require('./addressSchema');
const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        default:()=> uuidv4(),
        unique: true
    },
    orderedItems: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Product'
        },
        quantity: {
            type: Number,
            required: true,
        },
        price: {
            type: Number,
            default: 0,
        },
    }],
    totalPrice: {
        type: Number,
        required: true
    },
    discount:{
        type:Number,
        default:0
    },
    finalAmount:{
        type:Number,
        required:true
    },
    address: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Address'
    },
    invoiceDate: {
        type: Date
    },
    status:{
        type:String,
        default:'placed',
        enum:['pending','processing','shipped','delivered','cancelled','return requested','returned']
    },
    createdOn:{
        type:Date,
        default:Date.now,
        required:true
    },
    couponApplied:{
        type:Boolean,
        default:false
    },
});
const Order = mongoose.model('Order', orderSchema);
module.exports = Order;