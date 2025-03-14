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

        // Combine transactions and sort by date (latest first)
        let transactions = [...walletTransactions, ...razorpayTransactions]
            .sort((a, b) => new Date(b.date) - new Date(a.date));  // 🔥 Sort descending

        // Filter by type if provided
        if (type) {
            transactions = transactions.filter(txn => txn.type.toLowerCase() === type.toLowerCase());
        }

        // Search filter
        const searchQuery = req.query.search ? req.query.search.toLowerCase() : "";
        if (searchQuery) {
            transactions = transactions.filter(txn => txn.user.toLowerCase().includes(searchQuery));
        }

        // Calculate total credit and debit
        const totalCredit = transactions
            .filter(txn => txn.type === "credit" || txn.type === "Wallet Credit")
            .reduce((sum, txn) => sum + txn.amount, 0);

        const totalDebit = transactions
            .filter(txn => txn.type === "debit" || txn.type === "Razorpay" || txn.type === "Wallet Debit")
            .reduce((sum, txn) => sum + txn.amount, 0);

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const totalTransactions = transactions.length;
        const totalPages = Math.ceil(totalTransactions / limit);
        const skip = (page - 1) * limit;
        transactions = transactions.slice(skip, skip + limit);

        res.render("transactions", { 
            transactions, totalCredit, totalDebit, startDate, endDate, type, 
            page, totalPages, search: req.query.search || ""
        });

    } catch (error) {
        console.error("Error fetching transactions:", error);
        res.status(500).send("Internal Server Error");
    }
};



module.exports = {
    getTransactions
}