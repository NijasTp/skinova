const Wallet = require('../../models/walletSchema');
const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');

const getTransactions = async (req, res) => {
    try {
        const { startDate, endDate, type } = req.query;

        let dateFilter = {};
        if (startDate && endDate) {
            dateFilter = { 
                $gte: new Date(startDate), 
                $lte: new Date(endDate) 
            };
        }

        // Fetch all wallet transactions
        const walletTransactions = await Wallet.aggregate([
            { $unwind: "$transactions" },
            { 
                $match: { 
                    ...(startDate && endDate && { "transactions.date": dateFilter })
                } 
            },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "userDetails"
                }
            },
            { $unwind: "$userDetails" },
            {
                $project: {
                    _id: 0,
                    transactionId: "$transactions._id",
                    date: "$transactions.date",
                    user: "$userDetails.name",
                    type: "$transactions.type",
                    amount: "$transactions.amount",
                    source: "$transactions.description",
                    orderId: "$transactions.orderId"
                }
            }
        ]);

        // Fetch all Razorpay transactions (include all statuses)
        const razorpayTransactions = await Order.aggregate([
            { 
                $match: { 
                    paymentMethod: "razorpay",
                    ...(startDate && endDate && { createdOn: dateFilter })
                } 
            },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "userDetails"
                }
            },
            { $unwind: "$userDetails" },
            {
                $project: {
                    _id: 0,
                    transactionId: "$_id",
                    date: "$createdOn",
                    user: "$userDetails.name",
                    type: "Razorpay",  
                    amount: "$finalPrice",
                    source: { $concat: ["Order ID: ", "$orderId"] }
                }
            }
        ]);


        let transactions = [...walletTransactions, ...razorpayTransactions];

        // console.log(" Transactions Data:", transactions);


  
        if (type) {
            transactions = transactions.filter(txn => txn.type.toLowerCase() === type.toLowerCase());
        }

        const totalCredit = transactions
            .filter(txn => txn.type === "credit" || txn.type === "Wallet Credit")
            .reduce((sum, txn) => sum + txn.amount, 0);

        const totalDebit = transactions
            .filter(txn => txn.type === "debit" || txn.type === "Razorpay" || txn.type === "Wallet Debit")
            .reduce((sum, txn) => sum + txn.amount, 0);

        res.render("transactions", { transactions, totalCredit, totalDebit, startDate, endDate, type });

    } catch (error) {
        console.error("Error fetching transactions:", error);
        res.status(500).send("Internal Server Error");
    }
};



module.exports = {
    getTransactions
}