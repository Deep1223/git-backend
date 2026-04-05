const mongoose = require('mongoose');
const SpinLog = require('../modal/spinlog');

function mapSortField(field) {
    if (!field) return 'created_at';
    if (field === 'createdAt' || field === 'updatedAt') return 'created_at';
    const allowed = ['created_at', 'email', 'phone', 'reward', 'coupon_code', 'is_spinned', 'session_id'];
    return allowed.includes(field) ? field : 'created_at';
}

function mapSort(paginationinfo) {
    const incoming = paginationinfo?.sort || {};
    let field;
    let order = -1;

    if (incoming?.field) {
        field = mapSortField(incoming.field);
        const o = Number(incoming.order);
        if (o === 1 || o === -1) order = o;
    } else {
        const entries = Object.entries(incoming);
        if (entries.length > 0) {
            const [rawField, rawOrder] = entries[0];
            field = mapSortField(rawField);
            const o = Number(rawOrder);
            if (o === 1 || o === -1) order = o;
        }
    }

    return { [field]: order };
}

function parseListRequest(body = {}) {
    const paginationinfo = body.paginationinfo || {};
    const pageno = Math.max(1, Number(paginationinfo.pageno) || 1);
    const pagelimit = Math.max(1, Math.min(200, Number(paginationinfo.pagelimit) || 20));
    const skip = (pageno - 1) * pagelimit;
    const sort = mapSort(paginationinfo);
    const searchtext = String(body.searchtext || '').trim();
    const filter = { ...(paginationinfo.filter || {}) };
    return { filter, searchtext, sort, skip, limit: pagelimit, page: pageno };
}

function buildQuery(filter = {}, searchtext = '') {
    const query = {};

    if (filter.is_spinned !== undefined && filter.is_spinned !== null && filter.is_spinned !== '') {
        const v = filter.is_spinned;
        if (v === 1 || v === '1' || v === true || v === 'true') query.is_spinned = true;
        else if (v === 0 || v === '0' || v === false || v === 'false') query.is_spinned = false;
    }

    if (searchtext) {
        query.$or = [
            { email: { $regex: searchtext, $options: 'i' } },
            { phone: { $regex: searchtext, $options: 'i' } },
            { session_id: { $regex: searchtext, $options: 'i' } },
            { reward: { $regex: searchtext, $options: 'i' } },
            { coupon_code: { $regex: searchtext, $options: 'i' } },
        ];
    }

    return query;
}

function transformRow(doc) {
    const r = doc && typeof doc === 'object' ? { ...doc } : {};
    r.spun_label = r.is_spinned ? 'Yes' : 'No';
    if (r.created_at) {
        r.created_at =
            r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at;
    }
    return r;
}

exports.getAllSpinLogs = async (req, res) => {
    try {
        const { filter, searchtext, sort, skip, limit, page } = parseListRequest(req.body || {});
        const mongoFilter = buildQuery(filter, searchtext);
        const rows = await SpinLog.find(mongoFilter).sort(sort).skip(skip).limit(limit).lean();
        const totalCount = await SpinLog.countDocuments(mongoFilter);
        const data = rows.map(transformRow);

        res.status(200).json({
            success: true,
            totalCount,
            totalcount: totalCount,
            hasNextPage: page * limit < totalCount,
            data,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};

exports.getSpinLogById = async (req, res) => {
    try {
        const id = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid id' });
        }
        const row = await SpinLog.findById(id).lean();
        if (!row) return res.status(404).json({ success: false, message: 'Not found' });
        return res.status(200).json({ success: true, data: transformRow(row) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Server Error' });
    }
};

exports.createSpinLog = async (req, res) =>
    res.status(405).json({ success: false, message: 'Create is disabled. Spin logs are system-generated.' });

exports.updateSpinLog = async (req, res) =>
    res.status(405).json({ success: false, message: 'Update is disabled. Spin logs are read-only.' });

exports.deleteSpinLog = async (req, res) =>
    res.status(405).json({ success: false, message: 'Delete is disabled. Spin logs are read-only.' });
