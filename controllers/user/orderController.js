const express = require('express');
const router = express.Router();
const Order = require('../../models/orderSchema');
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");


const cancelOrder = async (req, res) => {
    try {
        const { itemId } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ error: "Cancellation reason is required" });
        }

        // Find the order containing the item
        const order = await Order.findOne({ "orderedItems.itemId": itemId });

        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }

        // Find the specific item inside the order
        const item = order.orderedItems.find(i => i.itemId === itemId);

        if (!item) {
            return res.status(404).json({ error: "Item not found" });
        }

        // Check if cancellation is allowed
        if (!["pending", "confirmed"].includes(item.status)) {
            return res.status(400).json({ error: "Order cannot be cancelled at this stage" });
        }

        // Update status and cancellation reason
        item.status = "cancelled";
        item.cancellationReason = reason;
        await order.save();

        res.status(200).json({ success: "Order cancelled successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}
const downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findOne({ orderId })
            .populate("orderedItems.product")  
            .populate("userId", "name email"); // ✅ Ensures user name & email are fetched

        if (!order) {
            return res.status(404).send("Order not found");
        }

        // Ensure invoices folder exists
        const invoiceDir = path.join(__dirname, "../invoices");
        if (!fs.existsSync(invoiceDir)) {
            fs.mkdirSync(invoiceDir, { recursive: true });
        }

        // Define invoice path
        const invoicePath = path.join(invoiceDir, `invoice-${orderId}.pdf`);

        // Create PDF
        const doc = new PDFDocument();
        const writeStream = fs.createWriteStream(invoicePath);
        doc.pipe(writeStream);
        doc.fontSize(20).text("Skinova Invoice", { align: "center" });
        doc.moveDown();
        doc.fontSize(14).text(`Order ID: ${order.orderId}`);
        doc.text(`Date: ${new Date(order.createdOn).toLocaleDateString()}`);
        doc.text(`Customer: ${order.userId?.name || "Unknown"}`); // ✅ Handles undefined safely
        doc.text(`Email: ${order.userId?.email || "Unknown"}`);
        doc.moveDown();
        doc.fontSize(16).text("Products", { underline: true });

        order.orderedItems.forEach((item, index) => {
            doc.fontSize(12).text(`${index + 1}. ${item.product.productName} - ₹${item.product.salePrice} x ${item.quantity}`);
        });

        doc.moveDown();
        doc.fontSize(14).text(`Total: ₹${order.finalAmount}`, { bold: true }); // ✅ Ensure correct total field
        doc.end();

        writeStream.on("finish", () => {
            res.download(invoicePath);
        });

    } catch (error) {
        console.error("Invoice Download Error:", error);
        res.status(500).send("Error generating invoice");
    }
};

const orderDetails = async (req, res) => {
    const { orderId, itemId } = req.params;

    try {
        const order = await Order.findOne({ orderId })
            .populate('orderedItems.product')
            .exec();

        if (!order) {
            return res.status(404).send('Order not found');
        }

        const orderedItem = order.orderedItems.find(item => item.itemId === itemId);

        if (!orderedItem) {
            return res.status(404).send('Item not found in this order');
        }

        res.render('order-details', { order, orderedItem });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
}

const requestReturn = async (req, res) => {
    try {
        const { itemId } = req.params;
        const { returnReason } = req.body;

        const order = await Order.findOne({ "orderedItems._id": itemId });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const orderedItem = order.orderedItems.find(item => item._id.toString() === itemId);

        if (!orderedItem) {
            return res.status(404).json({ success: false, message: "Item not found" });
        }

      
        if (orderedItem.returnRequested) {
            return res.status(400).json({ success: false, message: "Return already requested" });
        }

        
        orderedItem.returnRequested = true;
        orderedItem.status = "return request";
        orderedItem.returnReason = returnReason;

      
        await order.save();

        res.status(200).json({ success: true, message: "Return request submitted" });

    } catch (error) {
        console.error("Return request error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

module.exports = {
    cancelOrder,
    downloadInvoice,
    orderDetails,
    requestReturn

}