const EcomOrder = require('../../modal/ecomOrder');
const EcomShipment = require('../../modal/ecomShipment');
const { appendStatusHistory } = require('../../lib/ecomOrderAdminHelpers');
const { generateAwb, schedulePickup, providerName } = require('../../lib/courierProviders');

function actorId(req) {
    return req.user?._id ? String(req.user._id) : req.user?.id ? String(req.user.id) : '';
}

function str(v, max = 2000) {
    return String(v || '').trim().slice(0, max);
}

function dt(v) {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}

async function ensureOrder(orderId) {
    return EcomOrder.findById(orderId).select('_id orderStatus trackingUrl').lean();
}

async function ensureShipment(orderId) {
    let doc = await EcomShipment.findOne({ order: orderId });
    if (!doc) doc = await EcomShipment.create({ order: orderId, events: [] });
    return doc;
}

exports.getAdminShippingDetail = async (req, res) => {
    try {
        const order = await ensureOrder(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        const shipment = await EcomShipment.findOne({ order: order._id }).lean();
        return res.status(200).json({ success: true, data: shipment || null });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'shipping_detail_failed' });
    }
};

exports.listAdminShippingCases = async (req, res) => {
    try {
        const q = str(req.query?.q, 200);
        const pickupStatus = str(req.query?.pickupStatus, 50);
        const assignmentStatus = str(req.query?.assignmentStatus, 50);
        const exceptionStatus = str(req.query?.exceptionStatus, 50);

        const shipmentFilter = {};
        if (pickupStatus) shipmentFilter.pickupStatus = pickupStatus;
        if (assignmentStatus) shipmentFilter.assignmentStatus = assignmentStatus;
        if (exceptionStatus) shipmentFilter.exceptionStatus = exceptionStatus;

        const shipments = await EcomShipment.find(shipmentFilter)
            .sort({ updatedAt: -1, createdAt: -1 })
            .lean();

        const orderIds = shipments.map((s) => s.order);
        const orders = await EcomOrder.find({ _id: { $in: orderIds } })
            .populate('user', 'name email')
            .select('orderNumber orderStatus paymentStatus totalAmount shippingAddress trackingUrl createdAt')
            .lean();
        const orderMap = new Map(orders.map((o) => [String(o._id), o]));

        let data = shipments.map((shipment) => {
            const order = orderMap.get(String(shipment.order));
            return {
                id: String(shipment._id),
                orderId: String(shipment.order),
                orderNumber: order?.orderNumber || '',
                orderStatus: order?.orderStatus || '',
                paymentStatus: order?.paymentStatus || '',
                totalAmount: order?.totalAmount || 0,
                customerName: order?.shippingAddress?.name || order?.user?.name || '',
                phone: order?.shippingAddress?.phone || '',
                courierName: shipment.courierName || '',
                assignedTo: shipment.assignedTo || '',
                assignmentStatus: shipment.assignmentStatus,
                awbNumber: shipment.awbNumber || '',
                trackingUrl: shipment.trackingUrl || order?.trackingUrl || '',
                pickupStatus: shipment.pickupStatus,
                pickupScheduledAt: shipment.pickupScheduledAt,
                exceptionStatus: shipment.exceptionStatus,
                exceptionMessage: shipment.exceptionMessage || '',
                shippedAt: shipment.shippedAt,
                deliveredAt: shipment.deliveredAt,
                updatedAt: shipment.updatedAt,
            };
        });

        if (q) {
            const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            data = data.filter((row) =>
                rx.test(row.orderNumber || '') ||
                rx.test(row.customerName || '') ||
                rx.test(row.phone || '') ||
                rx.test(row.courierName || '') ||
                rx.test(row.awbNumber || '')
            );
        }

        return res.status(200).json({
            success: true,
            data,
            provider: providerName(),
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'shipping_list_failed' });
    }
};

exports.upsertAdminShippingDetail = async (req, res) => {
    try {
        const order = await ensureOrder(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        const shipment = await ensureShipment(order._id);
        const update = {
            courierCode: str(req.body?.courierCode, 100),
            courierName: str(req.body?.courierName, 200),
            serviceLevel: str(req.body?.serviceLevel, 100),
            awbNumber: str(req.body?.awbNumber, 200),
            awbDocumentUrl: str(req.body?.awbDocumentUrl, 2000),
            shippingLabelUrl: str(req.body?.shippingLabelUrl, 2000),
            trackingUrl: str(req.body?.trackingUrl, 2000),
            assignmentStatus: req.body?.assignmentStatus || shipment.assignmentStatus || 'unassigned',
            assignedTo: str(req.body?.assignedTo, 200),
            assignmentNotes: str(req.body?.assignmentNotes),
        };

        Object.assign(shipment, update);
        shipment.events.push({
            type: 'shipping_updated',
            label: 'Shipping details updated',
            note: update.assignmentNotes || 'Admin updated shipping workflow fields',
            by: actorId(req),
        });
        await shipment.save();

        if (update.trackingUrl && update.trackingUrl !== order.trackingUrl) {
            await EcomOrder.findByIdAndUpdate(order._id, { $set: { trackingUrl: update.trackingUrl } });
        }

        return res.status(200).json({ success: true, data: shipment.toObject() });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message || 'shipping_update_failed' });
    }
};

exports.updateAdminShippingPickup = async (req, res) => {
    try {
        const order = await ensureOrder(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        const shipment = await ensureShipment(order._id);

        shipment.pickupStatus = req.body?.pickupStatus || shipment.pickupStatus;
        shipment.pickupScheduledAt = dt(req.body?.pickupScheduledAt) ?? shipment.pickupScheduledAt;
        shipment.pickupBookedAt = dt(req.body?.pickupBookedAt) ?? shipment.pickupBookedAt;
        shipment.pickupWindowStart = dt(req.body?.pickupWindowStart) ?? shipment.pickupWindowStart;
        shipment.pickupWindowEnd = dt(req.body?.pickupWindowEnd) ?? shipment.pickupWindowEnd;
        shipment.pickupReference = str(req.body?.pickupReference, 200);

        shipment.events.push({
            type: 'pickup_updated',
            label: `Pickup ${shipment.pickupStatus}`,
            note: str(req.body?.note),
            by: actorId(req),
            meta: {
                pickupReference: shipment.pickupReference,
                pickupScheduledAt: shipment.pickupScheduledAt,
            },
        });
        await shipment.save();

        return res.status(200).json({ success: true, data: shipment.toObject() });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message || 'pickup_update_failed' });
    }
};

exports.generateAdminShippingAwb = async (req, res) => {
    try {
        const order = await ensureOrder(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        const shipment = await ensureShipment(order._id);
        const result = await generateAwb({ order, shipment, req });

        shipment.awbNumber = result.awbNumber || shipment.awbNumber;
        shipment.trackingUrl = result.trackingUrl || shipment.trackingUrl;
        shipment.shippingLabelUrl = result.shippingLabelUrl || shipment.shippingLabelUrl;
        shipment.awbDocumentUrl = result.awbDocumentUrl || shipment.awbDocumentUrl;
        shipment.assignmentStatus = shipment.assignmentStatus === 'unassigned' ? 'assigned' : shipment.assignmentStatus;
        shipment.events.push({
            type: 'awb_generated',
            label: 'AWB generated',
            note: str(req.body?.note) || `Generated by ${result.provider || providerName()}`,
            by: actorId(req),
            meta: result.meta || {},
        });
        await shipment.save();

        return res.status(200).json({ success: true, data: shipment.toObject(), provider: result.provider || providerName() });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message || 'awb_generate_failed' });
    }
};

exports.bookAdminShippingPickup = async (req, res) => {
    try {
        const order = await ensureOrder(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        const shipment = await ensureShipment(order._id);
        const result = await schedulePickup({ order, shipment, req });

        shipment.pickupStatus = 'booked';
        shipment.pickupBookedAt = new Date();
        shipment.pickupReference = result.pickupReference || shipment.pickupReference;
        shipment.events.push({
            type: 'pickup_booked',
            label: 'Pickup booked',
            note: str(req.body?.note) || `Pickup booked via ${result.provider || providerName()}`,
            by: actorId(req),
            meta: result.meta || {},
        });
        await shipment.save();

        return res.status(200).json({ success: true, data: shipment.toObject(), provider: result.provider || providerName() });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message || 'pickup_book_failed' });
    }
};

exports.updateAdminShippingException = async (req, res) => {
    try {
        const order = await ensureOrder(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        const shipment = await ensureShipment(order._id);

        const nextStatus = req.body?.exceptionStatus || shipment.exceptionStatus || 'open';
        shipment.exceptionStatus = nextStatus;
        shipment.exceptionCode = str(req.body?.exceptionCode, 100);
        shipment.exceptionMessage = str(req.body?.exceptionMessage);
        shipment.exceptionMeta = req.body?.exceptionMeta && typeof req.body.exceptionMeta === 'object' ? req.body.exceptionMeta : shipment.exceptionMeta;
        if (nextStatus === 'open' || nextStatus === 'monitoring') {
            shipment.exceptionOpenedAt = shipment.exceptionOpenedAt || new Date();
        }
        if (nextStatus === 'resolved') {
            shipment.exceptionResolvedAt = new Date();
        }
        shipment.events.push({
            type: 'exception_updated',
            label: `Exception ${nextStatus}`,
            note: shipment.exceptionMessage || str(req.body?.note),
            by: actorId(req),
            meta: { exceptionCode: shipment.exceptionCode },
        });
        await shipment.save();

        return res.status(200).json({ success: true, data: shipment.toObject() });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message || 'shipping_exception_failed' });
    }
};

exports.markAdminShipmentState = async (req, res) => {
    try {
        const order = await ensureOrder(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        const shipment = await ensureShipment(order._id);
        const state = str(req.body?.state, 50).toLowerCase();
        const note = str(req.body?.note);

        if (state === 'shipped') shipment.shippedAt = dt(req.body?.at) || new Date();
        if (state === 'delivered') shipment.deliveredAt = dt(req.body?.at) || new Date();

        shipment.events.push({
            type: 'shipment_state',
            label: state || 'state_updated',
            note,
            by: actorId(req),
            meta: { at: dt(req.body?.at) || new Date() },
        });
        await shipment.save();

        if (state === 'shipped' || state === 'delivered') {
            await appendStatusHistory(order._id, state, {
                userId: actorId(req),
                note: note || `Shipping workflow marked ${state}`,
            });
        }

        return res.status(200).json({ success: true, data: shipment.toObject() });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message || 'shipping_state_failed' });
    }
};
