const EcomOrder = require('../../modal/ecomOrder');
const EcomReturnRefund = require('../../modal/ecomReturnRefund');
const { appendStatusHistory } = require('../../lib/ecomOrderAdminHelpers');

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
    return EcomOrder.findById(orderId).select('_id totalAmount orderStatus cancelReason createdAt').lean();
}

async function ensureReturnRefund(order) {
    let doc = await EcomReturnRefund.findOne({ order: order._id });
    if (!doc) {
        doc = await EcomReturnRefund.create({
            order: order._id,
            status: 'requested',
            reason: str(order.cancelReason),
            customerNote: str(order.cancelReason),
            requestedAt: order.createdAt || new Date(),
            refund: { amount: Number(order.totalAmount || 0) },
            timeline: [{ status: 'requested', note: 'Return/refund case created', by: 'system' }],
        });
    }
    return doc;
}

function pushTimeline(doc, req, status, note, meta = {}) {
    doc.timeline.push({
        status,
        note: str(note),
        by: actorId(req),
        at: new Date(),
        meta,
    });
}

exports.getAdminReturnRefundDetail = async (req, res) => {
    try {
        const order = await ensureOrder(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        const doc = await EcomReturnRefund.findOne({ order: order._id }).lean();
        return res.status(200).json({ success: true, data: doc || null });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'return_refund_detail_failed' });
    }
};

exports.listAdminReturnRefundCases = async (req, res) => {
    try {
        const q = str(req.query?.q, 200);
        const status = str(req.query?.status, 50);
        const refundStatus = str(req.query?.refundStatus, 50);

        const filter = {};
        if (status) filter.status = status;
        if (refundStatus) filter['refund.status'] = refundStatus;

        const docs = await EcomReturnRefund.find(filter).sort({ updatedAt: -1, createdAt: -1 }).lean();
        const orderIds = docs.map((d) => d.order);
        const orders = await EcomOrder.find({ _id: { $in: orderIds } })
            .populate('user', 'name email')
            .select('orderNumber totalAmount paymentMethod paymentStatus orderStatus shippingAddress cancelReason')
            .lean();
        const orderMap = new Map(orders.map((o) => [String(o._id), o]));

        let data = docs.map((doc) => {
            const order = orderMap.get(String(doc.order));
            return {
                id: String(doc._id),
                orderId: String(doc.order),
                orderNumber: order?.orderNumber || '',
                orderStatus: order?.orderStatus || '',
                paymentStatus: order?.paymentStatus || '',
                paymentMethod: order?.paymentMethod || '',
                totalAmount: order?.totalAmount || 0,
                customerName: order?.shippingAddress?.name || order?.user?.name || '',
                phone: order?.shippingAddress?.phone || '',
                status: doc.status,
                reason: doc.reason || '',
                requestedAt: doc.requestedAt,
                approvedAt: doc.approvedAt,
                rejectedAt: doc.rejectedAt,
                receivedAt: doc.receivedAt,
                refundStatus: doc.refund?.status || 'not_started',
                refundAmount: doc.refund?.amount || 0,
                refundReference: doc.refund?.reference || '',
                proofCount: (doc.requestProofUrls?.length || 0) + (doc.refund?.proofUrls?.length || 0),
                updatedAt: doc.updatedAt,
            };
        });

        if (q) {
            const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            data = data.filter((row) =>
                rx.test(row.orderNumber || '') ||
                rx.test(row.customerName || '') ||
                rx.test(row.phone || '') ||
                rx.test(row.reason || '') ||
                rx.test(row.refundReference || '')
            );
        }

        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'return_refund_list_failed' });
    }
};

exports.approveOrRejectAdminReturn = async (req, res) => {
    try {
        const order = await ensureOrder(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        const doc = await ensureReturnRefund(order);
        const action = str(req.body?.action, 20).toLowerCase();
        const note = str(req.body?.note);
        const rejectionReason = str(req.body?.rejectionReason);
        const autoSchedulePickup = req.body?.autoSchedulePickup || false;

        if (action === 'approve') {
            // Check if return can be approved
            const approvalCheck = await validateReturnApproval(doc, order);
            if (!approvalCheck.valid) {
                return res.status(400).json({ 
                    success: false, 
                    message: approvalCheck.reason,
                    warnings: approvalCheck.warnings 
                });
            }

            // Update return status
            doc.status = 'approved';
            doc.approvalNote = note;
            doc.approvedAt = new Date();
            doc.approvedBy = actorId(req);
            
            // Add timeline entry
            pushTimeline(doc, req, 'approved', note || 'Return approved after review', {
                approvedBy: actorId(req),
                approvalConditions: approvalCheck.conditions
            });

            // Auto-schedule pickup if requested
            if (autoSchedulePickup) {
                const pickupResult = await scheduleReturnPickup(doc, order);
                doc.pickupScheduledAt = pickupResult.scheduledAt;
                doc.pickupReference = pickupResult.reference;
                doc.status = 'pickup_scheduled';
                pushTimeline(doc, req, 'pickup_scheduled', 'Pickup automatically scheduled', pickupResult);
            }

            // Update order status
            await appendStatusHistory(order._id, 'return_approved', {
                userId: actorId(req),
                note: note || 'Return approved and being processed',
            });

            // Send notifications
            await sendReturnNotifications(doc, 'approved', note);

        } else if (action === 'reject') {
            // Validate rejection
            const rejectionCheck = await validateReturnRejection(doc, rejectionReason);
            if (!rejectionCheck.valid) {
                return res.status(400).json({ 
                    success: false, 
                    message: rejectionCheck.reason 
                });
            }

            // Update return status
            doc.status = 'rejected';
            doc.rejectionReason = rejectionReason || note || 'Return request does not meet policy requirements';
            doc.rejectedAt = new Date();
            doc.rejectedBy = actorId(req);
            
            // Add timeline entry
            pushTimeline(doc, req, 'rejected', doc.rejectionReason, {
                rejectedBy: actorId(req),
                policyViolation: rejectionCheck.policyViolation
            });

            // Update order status
            await appendStatusHistory(order._id, 'return_rejected', {
                userId: actorId(req),
                note: doc.rejectionReason,
            });

            // Send notifications
            await sendReturnNotifications(doc, 'rejected', doc.rejectionReason);

        } else {
            return res.status(400).json({ success: false, message: 'Valid action required (approve/reject)' });
        }

        await doc.save();
        return res.status(200).json({ 
            success: true, 
            data: doc.toObject(),
            message: `Return ${action}d successfully`
        });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message || 'return_review_failed' });
    }
};

/**
 * Validate return approval conditions
 */
async function validateReturnApproval(returnDoc, order) {
    const warnings = [];
    const conditions = [];
    
    // Check return window (e.g., 30 days from delivery)
    const returnWindow = 30 * 24 * 60 * 60 * 1000; // 30 days
    const deliveryDate = order.deliveredAt || order.createdAt;
    const now = new Date();
    
    if (now.getTime() - deliveryDate.getTime() > returnWindow) {
        return {
            valid: false,
            reason: 'Return window expired (30 days from delivery)',
            policyViolation: 'return_window'
        };
    }
    
    // Check product condition requirements
    if (!returnDoc.requestProofUrls || returnDoc.requestProofUrls.length === 0) {
        warnings.push('No proof documents provided - approval may be risky');
    }
    
    // Check for high-value items requiring special approval
    if (returnDoc.refund?.amount > 10000) {
        conditions.push('High-value item - manager approval required');
    }
    
    // Check if customer has excessive returns
    const customerReturnCount = await getCustomerReturnCount(order.user);
    if (customerReturnCount > 5) {
        conditions.push('Customer has excessive returns - review pattern');
    }
    
    return {
        valid: true,
        warnings,
        conditions
    };
}

/**
 * Validate return rejection
 */
async function validateReturnRejection(returnDoc, reason) {
    // Check if rejection reason is valid
    const validRejectionReasons = [
        'return_window_expired',
        'product_condition_unacceptable',
        'proof_insufficient',
        'policy_violation',
        'fraud_suspected',
        'customer_request_withdrawal'
    ];
    
    if (!reason) {
        return {
            valid: false,
            reason: 'Rejection reason is required'
        };
    }
    
    // Check for potential customer service issues
    if (reason === 'proof_insufficient' && returnDoc.requestProofUrls.length > 3) {
        return {
            valid: false,
            reason: 'Customer provided sufficient proof - rejection not justified'
        };
    }
    
    return {
        valid: true,
        policyViolation: reason
    };
}

/**
 * Schedule return pickup
 */
async function scheduleReturnPickup(returnDoc, order) {
    // In real implementation, integrate with pickup scheduler
    const pickupReference = `RET-PU-${Date.now()}`;
    const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Next day
    
    return {
        reference: pickupReference,
        scheduledAt,
        courier: 'delhivery',
        instructions: 'Package items securely with original packaging if available'
    };
}

/**
 * Get customer return count
 */
async function getCustomerReturnCount(userId) {
    // In real implementation, query database
    return 2; // Mock value
}

/**
 * Send return notifications
 */
async function sendReturnNotifications(returnDoc, action, note) {
    try {
        const notificationService = require('../../lib/notificationService');
        
        // Get customer contact details (in real implementation, from order)
        const customerData = {
            customerEmail: 'customer@example.com', // Mock - get from order
            customerPhone: '9876543210', // Mock - get from order
            orderNumber: returnDoc.orderNumber,
            approvedAt: returnDoc.approvedAt,
            rejectionReason: returnDoc.rejectionReason,
            note
        };
        
        let notificationType;
        
        if (action === 'approved') {
            notificationType = 'return_approved';
        } else if (action === 'rejected') {
            notificationType = 'return_rejected';
        }
        
        if (notificationType) {
            const result = await notificationService.sendShippingNotification(notificationType, customerData);
            console.log(`${action} notification sent for return ${returnDoc._id}:`, result);
            return result;
        }
        
    } catch (error) {
        console.error('Failed to send return notification:', error);
        // Fallback to mock notification
        console.log(`Fallback: ${action} notification for return ${returnDoc._id}`);
        return { success: false, error: error.message };
    }
}

exports.updateAdminReturnRefund = async (req, res) => {
    try {
        const order = await ensureOrder(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        const doc = await ensureReturnRefund(order);
        const nextStatus = str(req.body?.status, 50) || doc.status;
        const note = str(req.body?.note);

        doc.status = nextStatus;
        if (req.body?.reason != null) doc.reason = str(req.body.reason);
        if (req.body?.customerNote != null) doc.customerNote = str(req.body.customerNote);
        if (req.body?.requestProofUrls && Array.isArray(req.body.requestProofUrls)) {
            doc.requestProofUrls = req.body.requestProofUrls.map((u) => str(u, 2000)).filter(Boolean);
        }
        if (req.body?.pickupScheduledAt != null) doc.pickupScheduledAt = dt(req.body.pickupScheduledAt);
        if (req.body?.pickupReference != null) doc.pickupReference = str(req.body.pickupReference, 200);
        if (req.body?.pickupNote != null) doc.pickupNote = str(req.body.pickupNote);
        if (req.body?.receivedAt != null) doc.receivedAt = dt(req.body.receivedAt);
        if (req.body?.receivedBy != null) doc.receivedBy = str(req.body.receivedBy, 200);
        if (req.body?.receivingNote != null) doc.receivingNote = str(req.body.receivingNote);
        if (req.body?.qualityCheckPassed != null) doc.qualityCheckPassed = Boolean(req.body.qualityCheckPassed);
        if (req.body?.qualityCheckNote != null) doc.qualityCheckNote = str(req.body.qualityCheckNote);

        if (req.body?.refund && typeof req.body.refund === 'object') {
            const refund = req.body.refund;
            if (refund.status != null) doc.refund.status = str(refund.status, 50) || doc.refund.status;
            if (refund.amount != null) doc.refund.amount = Math.max(0, Number(refund.amount || 0));
            if (refund.method != null) doc.refund.method = str(refund.method, 100);
            if (refund.reference != null) doc.refund.reference = str(refund.reference, 200);
            if (refund.processedAt != null) doc.refund.processedAt = dt(refund.processedAt);
            if (refund.note != null) doc.refund.note = str(refund.note);
            if (Array.isArray(refund.proofUrls)) {
                doc.refund.proofUrls = refund.proofUrls.map((u) => str(u, 2000)).filter(Boolean);
            }
        }

        pushTimeline(doc, req, nextStatus, note || `Return/refund updated to ${nextStatus}`);
        await doc.save();

        if (nextStatus === 'received') {
            await appendStatusHistory(order._id, 'returned', {
                userId: actorId(req),
                note: note || 'Return items received',
            });
        }
        if (nextStatus === 'refunded' || doc.refund.status === 'processed') {
            await appendStatusHistory(order._id, 'refunded', {
                userId: actorId(req),
                note: note || doc.refund.note || 'Refund processed',
            });
        }

        return res.status(200).json({ success: true, data: doc.toObject() });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message || 'return_refund_update_failed' });
    }
};
