const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const pdf = require('html-pdf-node');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');


const pageError = async (req, res) => {
    res.render('admin-error')
}


const loadLogin = (req, res) => {
    if (req.session.admin) {
        return res.redirect('/admin')
    }
    res.render('admin-login', { message: null })
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await User.findOne({ isAdmin: true, email: email });

        if (admin) {
            const passwordMatch = await bcrypt.compare(password, admin.password);
            if (passwordMatch) {
                // ✅ Store the admin's ObjectId instead of true
                req.session.admin = admin._id;
                return res.redirect('/admin');
            } else {
                return res.redirect('/admin/login');
            }
        } else {
            return res.redirect('/admin/login');
        }
    } catch (error) {
        console.log("Login Error", error);
        return res.redirect('/pageerror');
    }
};


const loadDashboard = async (req, res) => {
    try {
        const filter = req.query.filter || 'monthly';

        // Date Filtering Logic
        let dateFilter = {};
        if (filter === 'daily') {
            dateFilter = { deliveredOn: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } };
        } else if (filter === 'weekly') {
            let startOfWeek = new Date();
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); 
            startOfWeek.setHours(0, 0, 0, 0);

            dateFilter = { deliveredOn: { $gte: startOfWeek } };
        } else if (filter === 'monthly') {
            let startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
            dateFilter = { deliveredOn: { $gte: startOfMonth } };
        } else if (filter === 'yearly') {
            let startOfYear = new Date(new Date().getFullYear(), 0, 1);
            dateFilter = { deliveredOn: { $gte: startOfYear } };
        }

        // Apply filtering to all queries
        const matchCondition = { 
            status: { $in: ['delivered', 'return rejected'] }, 
            ...dateFilter 
        };

        const totalRevenue = await Order.aggregate([
            { $match: matchCondition },
            { $group: { _id: null, total: { $sum: '$finalPrice' } } }
        ]);

        const totalOrders = await Order.countDocuments(matchCondition);

        const totalProductsSold = await Order.aggregate([
            { $match: matchCondition },
            { $group: { _id: null, total: { $sum: '$quantity' } } }
        ]);

        const totalUsers = await User.countDocuments();

        const bestSellingProducts = await Order.aggregate([
            { $match: matchCondition },
            { $group: { _id: '$product', sales: { $sum: '$quantity' } } },
            { $sort: { sales: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: '$productDetails' },
            { $project: { name: '$productDetails.productName', sales: 1 } }
        ]);

        const bestSellingCategories = await Order.aggregate([
            { $match: matchCondition },
            {
                $lookup: {
                    from: 'products',
                    localField: 'product',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: '$productDetails' },
            {
                $group: {
                    _id: '$productDetails.category',
                    sales: { $sum: '$quantity' }
                }
            },
            { $sort: { sales: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'categories',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'categoryDetails'
                }
            },
            { $unwind: '$categoryDetails' },
            { $project: { name: '$categoryDetails.name', sales: 1 } }
        ]);

        const salesData = await Order.aggregate([
            { $match: matchCondition },
            {
                $group: {
                    _id: filter === 'daily' ? { $dateToString: { format: "%Y-%m-%d", date: "$deliveredOn" } } :
                        filter === 'weekly' ? { $isoWeek: "$deliveredOn" } :
                            filter === 'monthly' ? { $month: "$deliveredOn" } :
                                { $year: "$deliveredOn" },
                    total: { $sum: '$finalPrice' }
                }
            },
            { $sort: { '_id': 1 } }
        ]);

        const chartLabels = salesData.map(s => {
            if (filter === 'weekly') {
                let year = new Date().getFullYear();
                let firstDayOfYear = new Date(year, 0, 1);
                let weekStart = new Date(firstDayOfYear.getTime() + (s._id - 1) * 7 * 24 * 60 * 60 * 1000);
                let weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);

                return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
            }
            if (filter === 'monthly') {
                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                return monthNames[s._id - 1];
            }
            if (filter === 'daily') return s._id;
            return `Year ${s._id}`;
        });

        const chartData = salesData.map(s => s.total);

        const page = parseInt(req.query.page) || 1; 
        const limit = 5; 
        const skip = (page - 1) * limit;
        
        const deliveredProducts = await Order.find(matchCondition)
            .populate({ path: 'product', select: 'productName' })
            .populate({ path: 'userId', select: 'name' })
            .select('orderId userId quantity finalPrice deliveredOn product')
            .skip(skip)
            .limit(limit)
            .sort({ deliveredOn: -1 })
            .exec();
        
        const totalDeliveredCount = await Order.countDocuments(matchCondition); 
        const totalPages = Math.ceil(totalDeliveredCount / limit);
        
        const totalDiscountAmount = await Order.aggregate([
            { $match: matchCondition },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$discount" }
                }
            }
        ]);

        const totalCouponDiscount = await Order.aggregate([
            { $match: matchCondition },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$couponDiscount" }
                }
            }
        ]);

        res.render('dashboard', {
            totalRevenue: totalRevenue.length ? totalRevenue[0].total : 0,
            totalOrders,
            totalProductsSold: totalProductsSold.length ? totalProductsSold[0].total : 0,
            totalUsers,
            bestSellingProducts,
            bestSellingCategories,
            chartLabels,
            chartData,
            deliveredProducts,
            totalPages,
            currentPage: page,
            selectedFilter: filter,
            totalDiscount: totalDiscountAmount.length ? totalDiscountAmount[0].total : 0,
            totalCouponDiscount: totalCouponDiscount.length ? totalCouponDiscount[0].total : 0,
        });

    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.status(500).send('Internal Server Error');
    }
};



const downloadSoldProducts = async (req, res) => {
    try {

        const soldProducts = await Order.find({ status: { $in: ["delivered", "return rejected"] } })
            .populate({ path: "userId", select: "name" });

        let totalOrders = soldProducts.length;
        let totalSales = soldProducts.reduce((sum, order) => sum + order.finalPrice, 0);
        let totalDiscount = soldProducts.reduce((sum, order) => sum + (order.discount / 100) * order.finalPrice, 0);
        let totalCouponDiscount = soldProducts.reduce((sum, order) => sum + order.couponDiscount, 0);

        const html = `
<html lang="en">
 <head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Skinova Sales Report</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
   body {
    font-family: 'Roboto', sans-serif;
    padding: 20px;
    background-color: #f9f9f9;
   }
   h1 {
    text-align: center;
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 20px;
    color: #1a202c;
   }
   .summary {
    margin-top: 20px;
    font-size: 1.1rem;
    background-color: white;
    padding: 20px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    border-radius: 8px;
   }
   .summary p {
    margin: 0 0 10px;
   }
   .summary p strong {
    font-weight: 500;
    color: #2d3748;
   }
   table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 20px;
    background-color: white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    overflow: hidden;
   }
   th, td {
    border: 1px solid #ddd;
    padding: 12px;
    text-align: left;
   }
   th {
    background-color: #4a5568;
    font-weight: 500;
    color: white;
   }
   td {
    color: #4a5568;
   }
   .highlight {
    background-color: #f7fafc;
   }
   .footer {
    text-align: center;
    margin-top: 20px;
    font-size: 0.9rem;
    color: #718096;
   }
  </style>
 </head>
 <body>
  <h1>Skinova Sales Report</h1>
  <div class="summary">
   <p><strong>Total Orders:</strong> ${totalOrders}</p>
   <p><strong>Total Sales:</strong> ₹${totalSales.toFixed(2)}</p>
   <p><strong>Total Discount:</strong> ₹${totalDiscount.toFixed(2)}</p>
   <p><strong>Total Coupon Discount:</strong> ₹${totalCouponDiscount.toFixed(2)}</p>
  </div>
  <table>
   <thead>
    <tr>
     <th>Order ID</th>
     <th>Customer</th>
     <th>Final Price</th>
     <th>Discount (%)</th>
     <th>Coupon Discount</th>
     <th>Status</th>
     <th>Sold On</th>
    </tr>
   </thead>
   <tbody>
    ${soldProducts.map((order, index) => `
    <tr class="${index % 2 === 0 ? 'highlight' : ''}">
     <td>${order._id}</td>
     <td>${order.userId.name || "N/A"}</td>
     <td>₹${order.finalPrice.toFixed(2)}</td>
     <td>${order.discount}%</td>
     <td>₹${order.couponDiscount.toFixed(2)}</td>
     <td>${order.status}</td>
     <td>${order.deliveredOn ? new Date(order.deliveredOn).toLocaleDateString() : "N/A"}</td>
    </tr>
    `).join("")}
   </tbody>
  </table>
  <div class="footer">
   <p>Generated by Skinova Sales System</p>
  </div>
 </body>
</html>
        `;

        let file = { content: html };
        let options = { format: "A4", printBackground: true };

        pdf.generatePdf(file, options).then(pdfBuffer => {
            res.setHeader("Content-Disposition", 'attachment; filename="sold_products_report.pdf"');
            res.setHeader("Content-Type", "application/pdf");
            res.send(pdfBuffer);
        });

    } catch (error) {
        console.error("Error generating PDF:", error);
        res.status(500).send("Failed to generate PDF");
    }
}

const logout = async (req, res) => {
    try {
        if (req.session.admin) {
            delete req.session.admin;
        }
        res.redirect('/admin/login');
    } catch (error) {
        console.log('Logout Error', error);
        res.redirect('/pageerror');
    }
};






module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageError,
    logout,
    downloadSoldProducts,


}