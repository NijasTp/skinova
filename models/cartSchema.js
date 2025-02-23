const mongoose = require('mongoose');
const {Schema} = mongoose;

const cartSchema = new Schema({
    userId:{
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    cartTotal:{
        type: Number,
        required: false
    },
    items:[{
        productId:{
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity:{
            type: Number,
            required: true
        },
        price:{
            type: Number,
            required: false
        },
        totalPrice:{
            type: Number,
            required: false
        },
        status:{
            type: String,
            default: 'placed'
        },
        cancellationReason:{
            type: String,
            default: "none"
        }
    }]
})

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;