const mongoose = require('mongoose');
const { Schema } = mongoose;



const WalletSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    balance: {
        type: Number,
        default: 0
    },
    transactions: [
        {
            type: {
                type: String,
                enum: ['credit', 'debit'],
                required: true
            },
            amount: {
                type: Number,
                required: true
            },
            date: {
                type: Date,
                default: Date.now
            },
            description: {
                type: String
            },
            orderId: { 
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Order',  
                default: null
            }
        }
    ]
});

const Wallet = mongoose.model('Wallet', WalletSchema);

module.exports = Wallet;
