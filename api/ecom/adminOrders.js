const EcomOrder = require('../../modal/ecomOrder');

const ORDER_STATUSES = ['processing', 'confirmed', 'shipped', 'delivered', 'cancelled'];

/**
 * Dashboard: paginated list of all storefront orders with customer info.
 */
exports.listAdminOrders = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
        const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
        const filter = {};
        if (req.query.orderStatus && ORDER_STATUSES.includes(String(req.query.orderStatus))) {
            filter.orderStatus = req.query.orderStatus;
        }
        const skip = (page - 1) * limit;
        const [orders, total] = await Promise.all([
            EcomOrder.find(filter)
                .populate('user', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            EcomOrder.countDocuments(filter),
        ]);
        return res.status(200).json({
            success: true,
            data: orders,
            page,
            limit,
            total,
            totalPages: total ? Math.ceil(total / limit) : 0,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'admin_orders_failed' });
    }
};

/**
 * Dashboard: update fulfillment status (processing → delivered, etc.).
 */
exports.patchAdminOrderStatus = async (req, res) => {
    try {
        const orderStatus = String(req.body?.orderStatus || '').trim();
        if (!orderStatus || !ORDER_STATUSES.includes(orderStatus)) {
            return res.status(400).json({ success: false, message: 'Invalid orderStatus' });
        }
        const order = await EcomOrder.findByIdAndUpdate(
            req.params.id,
            { $set: { orderStatus } },
            { new: true }
        )
            .populate('user', 'name email')
            .lean();
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        return res.status(200).json({ success: true, data: order });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'order_update_failed' });
    }
};
