const mongoose = require('mongoose');
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid');

const orderSchema = new Schema({
    orderId: {
        type: String,
        default: () => uuidv4(),
        unique: true
    },
    userId: {  
        type: Schema.Types.ObjectId,
        ref: 'User', 
        required: true
    },
    product: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    productName: {
        type: String,
        required: true
    },
    productImage: [{
        type: String,
        required: true
    }],
    quantity: {
        type: Number,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        default: 0
    },
    finalPrice: {
        type: Number,
        required: true
    },
    couponDiscount: {
        type: Number,
        default: 0
    },
    shippingCharge: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        required: true,
        enum: ['pending','payment pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'return request', 'returned','return rejected']
    },
    deliveredOn:{
        type: Date,
    },
    cancellationReason: {  
        type: String, 
        default: null  
    },
    returnRequested: {
        type: Boolean,
        default: false
    },
    returnReason: {
        type: String,
        default: ''
    },
    address: {
        fullName: { type: String, required: true },
        mobile: { type: String, required: true },
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        pincode: { type: String, required: true },
    },
    invoiceDate: {
        type: Date
    },
    createdOn: {
        type: Date,
        default: Date.now,
        required: true
    },
    paymentStatus: { 
        type: String,
        enum: ['pending', 'paid', 'refunded'],
        default: 'pending'
    },
    estimatedDelivery: { 
        type: Date
    },
    paymentMethod: {
        type: String,
        enum: ['cod', 'razorpay','wallet'],
        required: true
    }
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
