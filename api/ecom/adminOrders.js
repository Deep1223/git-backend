const EcomOrder = require('../../modal/ecomOrder');
const EcomOrderStatusHistory = require('../../modal/ecomOrderStatusHistory');
const EcomShipment = require('../../modal/ecomShipment');
const EcomReturnRefund = require('../../modal/ecomReturnRefund');
const GeneralSetting = require('../../modal/generalsetting');
const { appendStatusHistory, normalizeOrderStatus } = require('../../lib/ecomOrderAdminHelpers');
const { sendOrderStatusEmail } = require('../../lib/ecomOrderEmail');
const { markOrderCancelled } = require('../../lib/ecomOrderLifecycle');

const ORDER_STATUSES = [...EcomOrder.ORDER_STATUS_ENUM];

/** Same rules as dashboard OrderManagementGridList — blocks invalid skips (e.g. packed → delivered). */
const NEXT_ORDER_STATUSES = {
    pending: ['pending', 'confirmed', 'cancelled'],
    confirmed: ['confirmed', 'packed', 'cancelled'],
    packed: ['packed', 'shipped', 'cancelled'],
    shipped: ['shipped', 'delivered', 'cancelled'],
    delivered: ['delivered', 'return_requested'],
    cancelled: ['cancelled'],
    return_requested: ['return_requested', 'returned'],
    returned: ['returned', 'refunded'],
    refunded: ['refunded'],
    processing: ['processing', 'confirmed', 'cancelled'],
};

function isAllowedAdminOrderTransition(prevRaw, nextRaw) {
    const prev = String(prevRaw || '').trim() || 'pending';
    const next = String(nextRaw || '').trim();
    if (prev === next) return true;
    if (next === 'cancelled') {
        return ['pending', 'processing', 'confirmed', 'packed', 'shipped'].includes(prev);
    }
    const allowed = NEXT_ORDER_STATUSES[prev];
    if (!allowed) return false;
    return allowed.includes(next);
}

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

function buildListFilter(orderStatusQuery, paymentStatusQuery, paymentMethodQuery) {
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
    if (paymentMethodQuery && ['cod', 'online'].includes(String(paymentMethodQuery))) {
        filter.paymentMethod = String(paymentMethodQuery);
    }
    return filter;
}

function appendCreatedAtRange(filter, query) {
    const from = String(query.dateFrom || '').trim();
    const to = String(query.dateTo || '').trim();
    if (!from && !to) return filter;
    const range = {};
    if (from) {
        const d = new Date(`${from}T00:00:00.000Z`);
        if (!Number.isNaN(d.getTime())) range.$gte = d;
    }
    if (to) {
        const d = new Date(`${to}T23:59:59.999Z`);
        if (!Number.isNaN(d.getTime())) range.$lte = d;
    }
    if (Object.keys(range).length) filter.createdAt = range;
    return filter;
}

function applyOrderListSearch(filter, qRaw) {
    const q = String(qRaw || '').trim();
    if (!q) return filter;
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
    } else if (filter.$and) {
        filter.$and.push(searchClause);
    } else {
        Object.assign(filter, searchClause);
    }
    return filter;
}

function applyChannelFilter(filter, channelRaw) {
    const channel = String(channelRaw || '').trim().toLowerCase();
    if (!channel || channel === 'all') return;
    const clause =
        channel === 'guest'
            ? { $or: [{ user: null }, { user: { $exists: false } }] }
            : channel === 'registered'
              ? { user: { $ne: null } }
              : null;
    if (!clause) return;

    const parts = [];
    if (filter.$and) parts.push(...filter.$and);
    if (filter.$or) {
        parts.push({ $or: filter.$or });
        delete filter.$or;
    }
    for (const k of Object.keys(filter)) {
        if (k === '$and') continue;
        parts.push({ [k]: filter[k] });
        delete filter[k];
    }
    if (filter.$and) delete filter.$and;
    parts.push(clause);
    filter.$and = parts;
}

/** List + CSV exports + reports — same filters (status tab, payment, payment method, channel, search, date range). */
function buildListQueryFilter(query) {
    const filter = buildListFilter(query.orderStatus, query.paymentStatus, query.paymentMethod);
    appendCreatedAtRange(filter, query);
    applyChannelFilter(filter, query.channel);
    applyOrderListSearch(filter, query.q || query.search);
    return filter;
}

/** Payment + date + search only (no order status tab) — for reports that set their own order/payment scope. */
function buildListQueryFilterWithoutOrderStatus(query) {
    const filter = buildListFilter(null, query.paymentStatus, query.paymentMethod);
    appendCreatedAtRange(filter, query);
    applyChannelFilter(filter, query.channel);
    applyOrderListSearch(filter, query.q || query.search);
    return filter;
}

/** KPI / summary: date, payment, channel, search — not order status (profit & loss use their own statuses). */
function buildReportKpiClauseArray(query, forcedCreatedAtRange = null) {
    const clauses = [];
    if (forcedCreatedAtRange && Object.keys(forcedCreatedAtRange).length) {
        clauses.push({ createdAt: forcedCreatedAtRange });
    } else {
        const from = String(query.dateFrom || '').trim();
        const to = String(query.dateTo || '').trim();
        if (from || to) {
            const range = {};
            if (from) {
                const d = new Date(`${from}T00:00:00.000Z`);
                if (!Number.isNaN(d.getTime())) range.$gte = d;
            }
            if (to) {
                const d = new Date(`${to}T23:59:59.999Z`);
                if (!Number.isNaN(d.getTime())) range.$lte = d;
            }
            if (Object.keys(range).length) clauses.push({ createdAt: range });
        }
    }
    const ps = String(query.paymentStatus || '').trim();
    if (ps && ['pending', 'paid', 'failed'].includes(ps)) {
        clauses.push({ paymentStatus: ps });
    }
    const pm = String(query.paymentMethod || '').trim();
    if (pm && ['cod', 'online'].includes(pm)) {
        clauses.push({ paymentMethod: pm });
    }
    const channel = String(query.channel || '').trim().toLowerCase();
    if (channel === 'guest') {
        clauses.push({ $or: [{ user: null }, { user: { $exists: false } }] });
    } else if (channel === 'registered') {
        clauses.push({ user: { $ne: null } });
    }
    const q = String(query.q || query.search || '').trim();
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
        clauses.push({ $or: orSearch });
    }
    return clauses;
}

function clausesToMatch(clauses, statusPart) {
    const all = statusPart ? [...clauses, statusPart] : [...clauses];
    if (!all.length) return {};
    return all.length === 1 ? all[0] : { $and: all };
}

function trendDateWindowUtc(query) {
    const endStr = String(query.dateTo || '').trim() || new Date().toISOString().slice(0, 10);
    const end = new Date(`${endStr}T23:59:59.999Z`);
    let start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 6);
    start.setUTCHours(0, 0, 0, 0);
    const fromStr = String(query.dateFrom || '').trim();
    if (fromStr) {
        const rf = new Date(`${fromStr}T00:00:00.000Z`);
        if (rf > start) start = rf;
    }
    return { start, end };
}

function listUtcDaysInclusive(start, end) {
    const keys = [];
    const cur = new Date(start);
    cur.setUTCHours(0, 0, 0, 0);
    const endDay = new Date(end);
    endDay.setUTCHours(0, 0, 0, 0);
    while (cur <= endDay) {
        keys.push(cur.toISOString().slice(0, 10));
        cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return keys;
}

/**
 * JSON: total profit (delivered totals), total loss (cancelled/refunded/returned), sparkline series (daily in trend window).
 */
exports.getOrderReportSummary = async (req, res) => {
    try {
        const q = req.query;
        const clausesBase = buildReportKpiClauseArray(q);
        const profitMatch = clausesToMatch(clausesBase, { orderStatus: 'delivered' });
        const lossMatch = clausesToMatch(clausesBase, {
            orderStatus: { $in: ['cancelled', 'refunded', 'returned'] },
        });

        const { start: twStart, end: twEnd } = trendDateWindowUtc(q);
        const trendClauses = buildReportKpiClauseArray(q, { $gte: twStart, $lte: twEnd });
        const profitTrendMatch = clausesToMatch(trendClauses, { orderStatus: 'delivered' });
        const lossTrendMatch = clausesToMatch(trendClauses, {
            orderStatus: { $in: ['cancelled', 'refunded', 'returned'] },
        });

        const baseMatch = clausesToMatch(clausesBase);
        const pendingMatch = clausesToMatch(clausesBase, { paymentStatus: 'pending' });

        const [
            profitRow,
            lossRow,
            profitDays,
            lossDays,
            overviewRow,
            pendingRow,
            payMethodSplit,
        ] = await Promise.all([
            EcomOrder.aggregate([
                { $match: profitMatch },
                { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
            ]),
            EcomOrder.aggregate([
                { $match: lossMatch },
                { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
            ]),
            EcomOrder.aggregate([
                { $match: profitTrendMatch },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' },
                        },
                        v: { $sum: '$totalAmount' },
                    },
                },
                { $sort: { _id: 1 } },
            ]),
            EcomOrder.aggregate([
                { $match: lossTrendMatch },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' },
                        },
                        v: { $sum: '$totalAmount' },
                    },
                },
                { $sort: { _id: 1 } },
            ]),
            EcomOrder.aggregate([
                { $match: baseMatch },
                { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
            ]),
            EcomOrder.aggregate([
                { $match: pendingMatch },
                { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
            ]),
            EcomOrder.aggregate([
                { $match: baseMatch },
                { $group: { _id: '$paymentMethod', c: { $sum: 1 } } },
            ]),
        ]);

        const trendKeys = listUtcDaysInclusive(twStart, twEnd);
        const mapP = Object.fromEntries((profitDays || []).map((x) => [x._id, x.v]));
        const mapL = Object.fromEntries((lossDays || []).map((x) => [x._id, x.v]));
        const profitSeries = trendKeys.map((k) => Number((mapP[k] || 0).toFixed(2)));
        const lossSeries = trendKeys.map((k) => Number((mapL[k] || 0).toFixed(2)));

        const totalOrders = overviewRow[0]?.count || 0;
        const grossSales = Number((overviewRow[0]?.total || 0).toFixed(2));
        const pendingTotal = Number((pendingRow[0]?.total || 0).toFixed(2));
        const pendingCount = pendingRow[0]?.count || 0;
        const avgOrderValue =
            totalOrders > 0 ? Number((grossSales / totalOrders).toFixed(2)) : 0;
        const codCount = (payMethodSplit || []).find((x) => x._id === 'cod')?.c || 0;
        const onlineCount = (payMethodSplit || []).find((x) => x._id === 'online')?.c || 0;

        return res.status(200).json({
            success: true,
            data: {
                totalProfit: Number((profitRow[0]?.total || 0).toFixed(2)),
                totalLoss: Number((lossRow[0]?.total || 0).toFixed(2)),
                profitOrderCount: profitRow[0]?.count || 0,
                lossOrderCount: lossRow[0]?.count || 0,
                profitSeries,
                lossSeries,
                trendLabels: trendKeys,
                totalOrders,
                grossSales,
                pendingPaymentTotal: pendingTotal,
                pendingPaymentCount: pendingCount,
                avgOrderValue,
                codOrderCount: codCount,
                onlineOrderCount: onlineCount,
                kpiNotes: {
                    profit: 'Delivered orders — sum of order total',
                    loss: 'Cancelled, refunded, or returned — sum of order total',
                    gross: 'All orders in range — sum of order totals',
                    orders: 'Orders matching date & payment filters',
                    pending: 'Payment status pending — value & count',
                    avg: 'Gross sales ÷ order count',
                    paySplit: 'COD vs online order counts',
                },
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'summary_failed' });
    }
};

function csvEscape(v) {
    const s = String(v == null ? '' : v).replace(/"/g, '""');
    return `"${s}"`;
}

function sendCsv(res, filenameBase, headers, rowArrays) {
    const csv = [headers.map(csvEscape).join(','), ...rowArrays.map((row) => row.map(csvEscape).join(','))].join('\r\n');
    const filename = `${filenameBase}-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send('\uFEFF' + csv);
}

const ORDER_REPORT_TYPES = new Set([
    'full_orders',
    'orders_summary',
    'order_line_items',
    'pending_failed_payments',
    'cod_prepaid_split',
    'cancelled_refunded',
]);

const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const REPORT_TZ = 'Asia/Kolkata';

async function sendReportXlsx(res, filenameBase, headers, rows) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Report', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true };
    rows.forEach((r) => ws.addRow(r));
    ws.columns.forEach((col) => {
        let max = 12;
        col.eachCell({ includeEmpty: true }, (cell) => {
            const len = cell.value != null ? String(cell.value).length : 0;
            if (len > max) max = Math.min(len, 48);
        });
        col.width = max + 2;
    });
    const buf = await wb.xlsx.writeBuffer();
    const filename = `${filenameBase}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(Buffer.from(buf));
}

function sendReportPdf(res, filenameBase, title, headers, rows) {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 48 });
    const filename = `${filenameBase}-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    doc.pipe(res);

    doc.fontSize(14).text(title || 'Order report', { underline: true });
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(7);

    const fmt = (cells) =>
        cells.map((c) => String(c == null ? '' : c).replace(/\|/g, '/').replace(/\s+/g, ' ').slice(0, 28)).join(' | ');

    doc.text(fmt(headers), { continued: false });
    doc.moveDown(0.25);

    const maxRows = 500;
    const slice = rows.slice(0, maxRows);
    slice.forEach((r) => {
        if (doc.y > doc.page.height - 72) {
            doc.addPage();
            doc.font('Helvetica').fontSize(7);
        }
        doc.text(fmt(r));
    });
    if (rows.length > maxRows) {
        doc.moveDown(0.5);
        doc.fontSize(9).text(`… ${rows.length - maxRows} more rows — use CSV or Excel for full export.`);
    }
    doc.end();
}

/**
 * Build tabular data for any order report. `query` uses same keys as list/export APIs.
 */
async function fetchOrderReportData(report, query) {
    if (report === 'full_orders') {
        const filter = buildListQueryFilter(query);
        const orders = await EcomOrder.find(filter)
            .populate('user', 'name email')
            .sort({ _id: -1 })
            .limit(5000)
            .lean();
        const headers = [
            'Order Number',
            'Order ID',
            'Date',
            'Customer Name',
            'Email',
            'Phone',
            'Address',
            'City',
            'State',
            'Pincode',
            'Items',
            'Subtotal',
            'Discount',
            'Total',
            'Payment Method',
            'Payment Status',
            'Order Status',
            'Channel',
            'Tracking URL',
            'Cancel Reason',
        ];
        const rows = orders.map((o) => {
            const ship = o.shippingAddress || {};
            const customerName = ship.name || o.user?.name || '';
            const email = ship.email || o.user?.email || '';
            const itemsSummary = (o.items || [])
                .map((i) => `${i.name} x${i.quantity} @${i.price}`)
                .join(' | ');
            const channel = o.user ? 'registered' : 'guest';
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
                channel,
                o.trackingUrl || '',
                o.cancelReason || '',
            ];
        });
        return { title: 'Full orders (detailed)', headers, rows };
    }

    if (report === 'orders_summary') {
        const match = buildListQueryFilter(query);
        const pipeline = [
            { $match: match },
            {
                $addFields: {
                    reportDate: {
                        $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: REPORT_TZ },
                    },
                    channel: { $cond: [{ $ne: ['$user', null] }, 'registered', 'guest'] },
                },
            },
            {
                $group: {
                    _id: {
                        date: '$reportDate',
                        orderStatus: '$orderStatus',
                        channel: '$channel',
                        paymentMethod: '$paymentMethod',
                        paymentStatus: '$paymentStatus',
                    },
                    orderCount: { $sum: 1 },
                    subtotalSum: { $sum: { $ifNull: ['$subtotalAmount', 0] } },
                    discountSum: { $sum: { $ifNull: ['$discountAmount', 0] } },
                    totalSum: { $sum: { $ifNull: ['$totalAmount', 0] } },
                },
            },
            { $sort: { '_id.date': -1, '_id.orderStatus': 1 } },
        ];
        const agg = await EcomOrder.aggregate(pipeline).allowDiskUse(true);
        const headers = [
            'Date (IST)',
            'Order Status',
            'Channel',
            'Payment Mode',
            'Payment Status',
            'Order Count',
            'Subtotal Sum',
            'Discount Sum',
            'Total Sum',
        ];
        const rows = agg.map((r) => [
            r._id.date || '',
            r._id.orderStatus || '',
            r._id.channel || '',
            r._id.paymentMethod || '',
            r._id.paymentStatus || '',
            r.orderCount,
            Number(r.subtotalSum.toFixed(2)),
            Number(r.discountSum.toFixed(2)),
            Number(r.totalSum.toFixed(2)),
        ]);
        return { title: 'Orders summary', headers, rows };
    }

    if (report === 'order_line_items') {
        const filter = buildListQueryFilter(query);
        const orders = await EcomOrder.find(filter)
            .populate('user', 'name email')
            .sort({ _id: -1 })
            .limit(5000)
            .lean();
        const headers = [
            'Order Number',
            'Order ID',
            'Order Date (ISO)',
            'Order Status',
            'Payment Mode',
            'Payment Status',
            'Channel',
            'Promo Code',
            'Order Subtotal',
            'Order Discount',
            'Order Total',
            'Line SKU/Series',
            'Product Name',
            'Qty',
            'Unit Price',
            'Line Gross',
            'Allocated Order Discount',
            'Line Net',
        ];
        const rows = [];
        for (const o of orders) {
            const items = o.items || [];
            const subtotal = Number(o.subtotalAmount) || 0;
            const disc = Number(o.discountAmount) || 0;
            const channel = o.user ? 'registered' : 'guest';
            const base = [
                o.orderNumber || '',
                String(o._id),
                o.createdAt ? new Date(o.createdAt).toISOString() : '',
                normalizeOrderStatus(o.orderStatus),
                o.paymentMethod || '',
                o.paymentStatus || '',
                channel,
                o.promoCode || '',
                subtotal,
                disc,
                o.totalAmount || 0,
            ];
            if (!items.length) {
                rows.push([...base, '', '', 0, 0, 0, 0, 0, 0]);
                continue;
            }
            for (const i of items) {
                const qty = Number(i.quantity) || 0;
                const price = Number(i.price) || 0;
                const lineGross = qty * price;
                let allocated = 0;
                if (subtotal > 0 && disc > 0) {
                    allocated = (lineGross / subtotal) * disc;
                }
                const lineNet = lineGross - allocated;
                rows.push([
                    ...base,
                    i.productSeries || '',
                    i.name || '',
                    qty,
                    price,
                    Number(lineGross.toFixed(2)),
                    Number(allocated.toFixed(2)),
                    Number(lineNet.toFixed(2)),
                ]);
            }
        }
        return { title: 'Order line items', headers, rows };
    }

    if (report === 'pending_failed_payments') {
        const filter = buildListQueryFilterWithoutOrderStatus(query);
        const ps = String(query.paymentStatus || '').trim();
        if (ps === 'pending' || ps === 'failed') {
            filter.paymentStatus = ps;
        } else {
            filter.paymentStatus = { $in: ['pending', 'failed'] };
        }
        const orders = await EcomOrder.find(filter)
            .populate('user', 'name email')
            .sort({ _id: -1 })
            .limit(5000)
            .lean();
        const headers = [
            'Order Number',
            'Order ID',
            'Created At (ISO)',
            'Payment Status',
            'Payment Mode',
            'Payment Reference',
            'Payment Provider',
            'Order Status',
            'Channel',
            'Customer Name',
            'Phone',
            'Email',
            'Total Amount',
            'Cancel Reason',
        ];
        const rows = orders.map((o) => {
            const ship = o.shippingAddress || {};
            return [
                o.orderNumber || '',
                String(o._id),
                o.createdAt ? new Date(o.createdAt).toISOString() : '',
                o.paymentStatus || '',
                o.paymentMethod || '',
                o.paymentReference || '',
                o.paymentProvider || '',
                normalizeOrderStatus(o.orderStatus),
                o.user ? 'registered' : 'guest',
                ship.name || o.user?.name || '',
                ship.phone || '',
                ship.email || o.user?.email || '',
                o.totalAmount || 0,
                o.cancelReason || '',
            ];
        });
        return { title: 'Pending / failed payments', headers, rows };
    }

    if (report === 'cod_prepaid_split') {
        const match = buildListQueryFilter(query);
        const pipeline = [
            { $match: match },
            {
                $group: {
                    _id: {
                        paymentMethod: '$paymentMethod',
                        paymentStatus: '$paymentStatus',
                    },
                    orderCount: { $sum: 1 },
                    totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
                    subtotalSum: { $sum: { $ifNull: ['$subtotalAmount', 0] } },
                    discountSum: { $sum: { $ifNull: ['$discountAmount', 0] } },
                },
            },
            { $sort: { '_id.paymentMethod': 1, '_id.paymentStatus': 1 } },
        ];
        const agg = await EcomOrder.aggregate(pipeline);
        const headers = [
            'Payment Mode',
            'Payment Status',
            'Order Count',
            'Subtotal Sum',
            'Discount Sum',
            'Total Amount Sum',
        ];
        const rows = agg.map((r) => [
            r._id.paymentMethod === 'online' ? 'prepaid (online)' : r._id.paymentMethod || '',
            r._id.paymentStatus || '',
            r.orderCount,
            Number(r.subtotalSum.toFixed(2)),
            Number(r.discountSum.toFixed(2)),
            Number(r.totalAmount.toFixed(2)),
        ]);
        return { title: 'COD vs prepaid split', headers, rows };
    }

    if (report === 'cancelled_refunded') {
        const filter = buildListQueryFilterWithoutOrderStatus(query);
        filter.orderStatus = { $in: ['cancelled', 'refunded'] };
        const orders = await EcomOrder.find(filter)
            .populate('user', 'name email')
            .sort({ _id: -1 })
            .limit(5000)
            .lean();
        const headers = [
            'Order Number',
            'Order ID',
            'Created At (ISO)',
            'Updated At (ISO)',
            'Order Status',
            'Payment Mode',
            'Payment Status',
            'Channel',
            'Cancel Reason',
            'Subtotal',
            'Discount',
            'Total',
            'Customer Name',
            'Phone',
        ];
        const rows = orders.map((o) => {
            const ship = o.shippingAddress || {};
            return [
                o.orderNumber || '',
                String(o._id),
                o.createdAt ? new Date(o.createdAt).toISOString() : '',
                o.updatedAt ? new Date(o.updatedAt).toISOString() : '',
                normalizeOrderStatus(o.orderStatus),
                o.paymentMethod || '',
                o.paymentStatus || '',
                o.user ? 'registered' : 'guest',
                o.cancelReason || '',
                o.subtotalAmount || 0,
                o.discountAmount || 0,
                o.totalAmount || 0,
                ship.name || o.user?.name || '',
                ship.phone || '',
            ];
        });
        return { title: 'Cancelled & refunded', headers, rows };
    }

    return null;
}

/**
 * Dashboard: paginated list with optional status filter and search.
 */
exports.listAdminOrders = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
        const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
        const skip = (page - 1) * limit;
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

        const filter = buildListQueryFilter(req.query);

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

    if (String(prev.orderStatus) !== String(orderStatus) && !isAllowedAdminOrderTransition(prev.orderStatus, orderStatus)) {
        return { error: { status: 400, message: 'Invalid status transition for current order state' } };
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
        const filter = buildListQueryFilter(req.query);

        const orders = await EcomOrder.find(filter)
            .populate('user', 'name email')
            .sort({ _id: -1 })
            .limit(5000)
            .lean();

        const headers = [
            'Order Number', 'Order ID', 'Date', 'Customer Name', 'Email', 'Phone',
            'Address', 'City', 'State', 'Pincode',
            'Items', 'Subtotal', 'Discount', 'Total', 'Payment Method', 'Payment Status',
            'Order Status', 'Channel', 'Tracking URL', 'Cancel Reason',
        ];

        const rows = orders.map((o) => {
            const ship = o.shippingAddress || {};
            const customerName = ship.name || o.user?.name || '';
            const email = ship.email || o.user?.email || '';
            const itemsSummary = (o.items || [])
                .map((i) => `${i.name} x${i.quantity} @${i.price}`)
                .join(' | ');
            const channel = o.user ? 'registered' : 'guest';
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
                channel,
                o.trackingUrl || '',
                o.cancelReason || '',
            ];
        });

        return sendCsv(res, 'orders', headers, rows);
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'csv_export_failed' });
    }
};

/**
 * Order reports: ?report=&format=csv|xlsx|pdf — filters: orderStatus, paymentStatus, paymentMethod, channel, q, dateFrom, dateTo.
 */
exports.exportOrdersReport = async (req, res) => {
    try {
        const report = String(req.query.report || '').trim();
        const format = String(req.query.format || 'csv').trim().toLowerCase();
        if (!ORDER_REPORT_TYPES.has(report)) {
            return res.status(400).json({
                success: false,
                message:
                    'Invalid report. Use: full_orders | orders_summary | order_line_items | pending_failed_payments | cod_prepaid_split | cancelled_refunded',
            });
        }
        if (!['csv', 'xlsx', 'pdf'].includes(format)) {
            return res.status(400).json({ success: false, message: 'Invalid format. Use: csv | xlsx | pdf' });
        }

        const data = await fetchOrderReportData(report, req.query);
        if (!data) {
            return res.status(400).json({ success: false, message: 'Unknown report' });
        }

        const { title, headers, rows } = data;
        const base = `report-${report}`;

        if (format === 'csv') {
            return sendCsv(res, base, headers, rows);
        }
        if (format === 'xlsx') {
            return sendReportXlsx(res, base, headers, rows);
        }
        return sendReportPdf(res, base, title, headers, rows);
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'report_export_failed' });
    }
};

exports.exportOrdersReportCsv = exports.exportOrdersReport;

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
