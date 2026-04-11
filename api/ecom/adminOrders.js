const EcomOrder = require('../../modal/ecomOrder');
const EcomOrderStatusHistory = require('../../modal/ecomOrderStatusHistory');
const EcomShipment = require('../../modal/ecomShipment');
const EcomReturnRefund = require('../../modal/ecomReturnRefund');
const GeneralSetting = require('../../modal/generalsetting');
const { appendStatusHistory, normalizeOrderStatus } = require('../../lib/ecomOrderAdminHelpers');
const { sendOrderStatusEmail } = require('../../lib/ecomOrderEmail');
const { markOrderCancelled } = require('../../lib/ecomOrderLifecycle');

const ORDER_STATUSES = [...EcomOrder.ORDER_STATUS_ENUM];

const BULK_ACTION_MAP = {
    confirm: 'confirmed',
    packed: 'packed',
    shipped: 'shipped',
    delivered: 'delivered',
    cancel: 'cancelled',
    return_received: 'returned',
    refund: 'refunded',
};

function actorId(req) {
    return req.user?._id ? String(req.user._id) : req.user?.id ? String(req.user.id) : '';
}

function buildListFilter(orderStatusQuery, paymentStatusQuery) {
    const filter = {};
    if (orderStatusQuery && orderStatusQuery !== 'all') {
        const want = String(orderStatusQuery).trim();
        if (want === 'pending') {
            filter.$or = [{ orderStatus: 'pending' }, { orderStatus: 'processing' }];
        } else if (ORDER_STATUSES.includes(want)) {
            filter.orderStatus = want;
        }
    }
    if (paymentStatusQuery && ['pending', 'paid', 'failed'].includes(String(paymentStatusQuery))) {
        filter.paymentStatus = String(paymentStatusQuery);
    }
    return filter;
}

/**
 * Dashboard: paginated list with optional status filter and search.
 */
exports.listAdminOrders = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
        const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
        const skip = (page - 1) * limit;
        const q = String(req.query.q || req.query.search || '').trim();
        const sortWhitelist = new Set(['createdAt', 'totalAmount', 'orderStatus', 'paymentStatus', 'orderNumber']);
        const rawSort = String(req.query.sort || '').trim();
        const rawOrder = String(req.query.order || '').trim().toLowerCase();

        let sortObj;
        if (!rawSort || rawSort === 'none') {
            sortObj = { _id: -1 };
        } else if (sortWhitelist.has(rawSort) && (rawOrder === 'asc' || rawOrder === 'desc')) {
            const sortDir = rawOrder === 'asc' ? 1 : -1;
            sortObj = { [rawSort]: sortDir };
        } else {
            sortObj = { _id: -1 };
        }

        const filter = buildListFilter(req.query.orderStatus, req.query.paymentStatus);

        if (q) {
            const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            const orSearch = [
                { orderNumber: rx },
                { 'shippingAddress.name': rx },
                { 'shippingAddress.phone': rx },
                { 'shippingAddress.email': rx },
                { 'shippingAddress.city': rx },
                { 'shippingAddress.pincode': rx },
                { paymentReference: rx },
            ];
            if (/^[a-f\d]{24}$/i.test(q)) {
                try {
                    const mongoose = require('mongoose');
                    orSearch.push({ _id: new mongoose.Types.ObjectId(q) });
                } catch (_e) {
                    /* ignore */
                }
            }
            const searchClause = { $or: orSearch };
            if (filter.$or) {
                filter.$and = [{ $or: filter.$or }, searchClause];
                delete filter.$or;
            } else {
                Object.assign(filter, searchClause);
            }
        }

        const [orders, total] = await Promise.all([
            EcomOrder.find(filter)
                .populate('user', 'name email')
                .sort(sortObj)
                .skip(skip)
                .limit(limit)
                .lean(),
            EcomOrder.countDocuments(filter),
        ]);

        const data = orders.map((o) => ({
            ...o,
            displayStatus: normalizeOrderStatus(o.orderStatus),
        }));

        return res.status(200).json({
            success: true,
            data,
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
 * Single order with status timeline.
 */
exports.getAdminOrderDetail = async (req, res) => {
    try {
        const order = await EcomOrder.findById(req.params.id).populate('user', 'name email phone').lean();
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        const [history, shipment, returnRefund] = await Promise.all([
            EcomOrderStatusHistory.find({ order: order._id }).sort({ createdAt: -1 }).lean(),
            EcomShipment.findOne({ order: order._id }).lean(),
            EcomReturnRefund.findOne({ order: order._id }).lean(),
        ]);
        return res.status(200).json({
            success: true,
            data: {
                ...order,
                displayStatus: normalizeOrderStatus(order.orderStatus),
                statusHistory: history,
                shipment: shipment || null,
                returnRefund: returnRefund || null,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'order_detail_failed' });
    }
};

async function applyOrderUpdate(orderId, body, req) {
    const orderStatus = String(body?.orderStatus || '').trim();
    if (!orderStatus || !ORDER_STATUSES.includes(orderStatus)) {
        return { error: { status: 400, message: 'Invalid orderStatus' } };
    }

    const prev = await EcomOrder.findById(orderId).lean();
    if (!prev) {
        return { error: { status: 404, message: 'Order not found' } };
    }

    if (orderStatus === 'cancelled') {
        const result = await markOrderCancelled(orderId, {
            userId: actorId(req),
            cancelReason: body.cancelReason,
            note: body?.note || '',
            paymentStatus: prev.paymentMethod === 'online' && prev.paymentStatus === 'pending' ? 'failed' : undefined,
        });
        if (result.error) return { error: result.error };
        return {
            order: {
                ...result.order,
                displayStatus: normalizeOrderStatus(result.order.orderStatus),
            },
        };
    }

    const set = { orderStatus };
    if (body.trackingUrl != null && orderStatus === 'shipped') {
        set.trackingUrl = String(body.trackingUrl || '').trim().slice(0, 2000);
    }

    if (orderStatus === 'delivered' && prev.paymentMethod === 'cod' && prev.paymentStatus === 'pending') {
        set.paymentStatus = 'paid';
    }

    const order = await EcomOrder.findByIdAndUpdate(orderId, { $set: set }, { new: true })
        .populate('user', 'name email')
        .lean();

    if (String(prev.orderStatus) !== String(orderStatus)) {
        await appendStatusHistory(orderId, orderStatus, {
            userId: actorId(req),
            note: body?.note || '',
        });
        // Send email notification to customer (non-blocking)
        sendOrderStatusEmail(order, orderStatus);
    }

    return {
        order: {
            ...order,
            displayStatus: normalizeOrderStatus(order.orderStatus),
        },
    };
}

/**
 * Dashboard: update fulfillment status + optional cancel reason / tracking.
 */
exports.patchAdminOrderStatus = async (req, res) => {
    try {
        const result = await applyOrderUpdate(req.params.id, req.body, req);
        if (result.error) {
            return res.status(result.error.status).json({ success: false, message: result.error.message });
        }
        return res.status(200).json({ success: true, data: result.order });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'order_update_failed' });
    }
};

/**
 * Bulk status update (same table, history rows per order).
 */
exports.bulkAdminOrderStatus = async (req, res) => {
    try {
        const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((id) => String(id)) : [];
        const action = String(req.body?.action || '').trim();
        const nextStatus = BULK_ACTION_MAP[action];
        if (!ids.length || !nextStatus) {
            return res.status(400).json({ success: false, message: 'ids[] and valid action required' });
        }
        const cancelReason =
            nextStatus === 'cancelled' && req.body?.cancelReason != null
                ? String(req.body.cancelReason).slice(0, 2000)
                : '';

        const results = { updated: 0, failed: [] };

        for (const id of ids) {
            try {
                const body = { orderStatus: nextStatus };
                if (nextStatus === 'cancelled') body.cancelReason = cancelReason;
                const result = await applyOrderUpdate(id, body, req);
                if (result.error) {
                    results.failed.push({ id, message: result.error.message });
                } else {
                    results.updated += 1;
                }
            } catch (e) {
                results.failed.push({ id, message: e.message || 'update_failed' });
            }
        }

        return res.status(200).json({ success: true, data: results });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'bulk_update_failed' });
    }
};

/**
 * Export orders as CSV with current filters applied.
 */
exports.exportOrdersCsv = async (req, res) => {
    try {
        const q = String(req.query.q || req.query.search || '').trim();
        const filter = buildListFilter(req.query.orderStatus, req.query.paymentStatus);

        if (q) {
            const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            const orSearch = [
                { orderNumber: rx },
                { 'shippingAddress.name': rx },
                { 'shippingAddress.phone': rx },
                { 'shippingAddress.email': rx },
                { 'shippingAddress.city': rx },
                { 'shippingAddress.pincode': rx },
                { paymentReference: rx },
            ];
            const searchClause = { $or: orSearch };
            if (filter.$or) {
                filter.$and = [{ $or: filter.$or }, searchClause];
                delete filter.$or;
            } else {
                Object.assign(filter, searchClause);
            }
        }

        const orders = await EcomOrder.find(filter)
            .populate('user', 'name email')
            .sort({ _id: -1 })
            .limit(5000)
            .lean();

        const escape = (v) => {
            const s = String(v == null ? '' : v).replace(/"/g, '""');
            return `"${s}"`;
        };

        const headers = [
            'Order Number', 'Order ID', 'Date', 'Customer Name', 'Email', 'Phone',
            'Address', 'City', 'State', 'Pincode',
            'Items', 'Subtotal', 'Discount', 'Total', 'Payment Method', 'Payment Status',
            'Order Status', 'Tracking URL', 'Cancel Reason',
        ];

        const rows = orders.map((o) => {
            const ship = o.shippingAddress || {};
            const customerName = ship.name || o.user?.name || '';
            const email = ship.email || o.user?.email || '';
            const itemsSummary = (o.items || [])
                .map((i) => `${i.name} x${i.quantity} @${i.price}`)
                .join(' | ');
            return [
                o.orderNumber || '',
                String(o._id),
                o.createdAt ? new Date(o.createdAt).toISOString() : '',
                customerName,
                email,
                ship.phone || '',
                ship.line1 || '',
                ship.city || '',
                ship.state || '',
                ship.pincode || '',
                itemsSummary,
                o.subtotalAmount || 0,
                o.discountAmount || 0,
                o.totalAmount || 0,
                o.paymentMethod || '',
                o.paymentStatus || '',
                normalizeOrderStatus(o.orderStatus),
                o.trackingUrl || '',
                o.cancelReason || '',
            ].map(escape).join(',');
        });

        const csv = [headers.map(escape).join(','), ...rows].join('\r\n');
        const filename = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).send('\uFEFF' + csv); // BOM for Excel UTF-8 compatibility
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'csv_export_failed' });
    }
};

/**
 * Returns JSON label data for selected orders (frontend renders HTML labels).
 */
exports.printOrderLabelsPdf = async (req, res) => {
    try {
        const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((id) => String(id)) : [];
        const statusFilter = req.body?.status ? String(req.body.status) : null;

        // Must provide either ids or a status filter
        if (!ids.length && !statusFilter) {
            return res.status(400).json({ success: false, message: 'Provide ids or a status filter' });
        }

        const query = ids.length
            ? { _id: { $in: ids } }
            : { orderStatus: statusFilter };

        const [orders, settings] = await Promise.all([
            EcomOrder.find(query)
                .sort({ createdAt: -1 })
                .limit(200)
                .populate('user', 'name email phone')
                .lean(),
            GeneralSetting.findOne().lean(),
        ]);

        if (!orders.length) {
            return res.status(404).json({ success: false, message: 'No orders found' });
        }

        const store = {
            name: settings?.storeName || 'Store',
            address: settings?.storeAddress || '',
            phone: settings?.storePhone || '',
            logo: settings?.logoUrl || settings?.logo || '',
        };

        const labels = orders.map((o) => {
            const ship = o.shippingAddress || {};
            const name = (ship.name && String(ship.name).trim()) ? String(ship.name).trim() : (o.user?.name || 'Customer');
            const addressLine = [ship.line1, ship.line2].filter(Boolean).join(', ');
            const cityLine = [ship.city, ship.state, ship.pincode].filter(Boolean).join(', ');
            const itemSummary = (o.items || []).map((i) => `${i.name} x${i.quantity}`).join(', ');
            const firstItem = (o.items || [])[0];
            return {
                orderId: String(o._id),
                orderNumber: o.orderNumber || String(o._id),
                customerName: name,
                phone: ship.phone || o.user?.phone || '',
                addressLine,
                cityLine,
                itemSummary,
                firstProductName: firstItem?.name || '',
                firstSku: firstItem?.productSeries || '',
                firstQty: firstItem?.quantity,
                itemCount: (o.items || []).length,
                trackingUrl: o.trackingUrl || '',
                totalAmount: o.totalAmount || 0,
                paymentMethod: o.paymentMethod || '',
                paymentStatus: o.paymentStatus || '',
                pincode: ship.pincode || '',
                createdAt: o.createdAt,
            };
        });

        return res.status(200).json({ success: true, labels, store });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'label_data_failed' });
    }
};
