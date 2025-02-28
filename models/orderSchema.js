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
    orderedItems: [{
        itemId: {
            type: String,
            default: () => uuidv4()  
        },
        product: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true
        },
        price: {
            type: Number,
            default: 0
        },
        status: {
            type: String,
            required: true,
            enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'return request', 'returned']
        },
        cancellationReason: {  
            type: String, 
            default: null  
        },
        returnRequested: {
            type:Boolean,
            default:false
        },
        returnReason:{
            type:String,
            default:''
        },
        couponApplied:{

        }
    }],
    totalPrice: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        default: 0
    },
    finalAmount: {
        type: Number,
        required: true
    },
    address: {
        type: Schema.Types.ObjectId,
        ref: 'Address', 
        required: true
    },
    invoiceDate: {
        type: Date
    },
    createdOn: {
        type: Date,
        default: Date.now,
        required: true
    },
    couponApplied: {
        type: Boolean,
        default: false
    },
    paymentStatus: { 
        type: String,
        enum: ['pending', 'paid', 'refunded'],
        default: 'pending'
    },
    estimatedDelivery: { 
        type: Date
    },
    orderCancellationReason: {  
        type: String,
        default: null
    },
    paymentMethod:{
        type:String,
        enum:['cod','razorpay']
    }
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
