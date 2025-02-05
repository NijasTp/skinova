const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    items: [
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                required: true,
                ref: 'Product'
            },
            quantity: {
                type: Number,
                default: 1
            },
            price: {
                type: Number,
                required: true
            },
            totalPrice: {
                type: Number,
                required: true
            },
            status: {
                type: String,
                default: 'placed'
            },
            cancellationReason: {
                type: String,
                default: 'none'
        },
            createdAt: {
                 type: Date,
                 default: Date.now
        }
    }],

});
const Cart = mongoose.model('Cart', cartSchema);
module.exports = Cart;