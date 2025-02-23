const express = require('express');
const router = express.Router();
const Order = require('../../models/orderSchema');

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


module.exports = {
    cancelOrder,

}