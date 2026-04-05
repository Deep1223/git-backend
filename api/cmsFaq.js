const CmsFaqEntry = require('../modal/cmsFaqEntry');

function mapSort(incomingSort) {
    if (incomingSort?.field) {
        const f =
            incomingSort.field === 'createdAt'
                ? 'createdAt'
                : incomingSort.field === 'updatedAt'
                  ? 'updatedAt'
                  : incomingSort.field;
        const o = Number(incomingSort.order);
        if (f && (o === 1 || o === -1)) return { [f]: o };
    }
    const entries = Object.entries(incomingSort || {});
    if (entries.length) {
        const [rawField, rawOrder] = entries[0];
        const f =
            rawField === 'createdAt'
                ? 'createdAt'
                : rawField === 'updatedAt'
                  ? 'updatedAt'
                  : rawField;
        const o = Number(rawOrder);
        if (f && (o === 1 || o === -1)) return { [f]: o };
    }
    return { sortOrder: 1, createdAt: 1 };
}

exports.getAllCmsFaq = async (req, res) => {
    try {
        const { paginationinfo, searchtext } = req.body;
        let filter = paginationinfo?.filter || {};
        if (searchtext) {
            filter.$or = [
                { question: { $regex: searchtext, $options: 'i' } },
                { answer: { $regex: searchtext, $options: 'i' } },
                { groupTitle: { $regex: searchtext, $options: 'i' } },
            ];
        }
        const sort = mapSort(paginationinfo?.sort || {});
        const page = paginationinfo?.pageno || 1;
        const limit = paginationinfo?.pagelimit || 20;
        const skip = (page - 1) * limit;
        const rows = await CmsFaqEntry.find(filter).sort(sort).skip(skip).limit(limit).lean();
        const totalCount = await CmsFaqEntry.countDocuments(filter);
        return res.status(200).json({
            success: true,
            totalCount,
            count: rows.length,
            data: rows,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getCmsFaqById = async (req, res) => {
    try {
        const row = await CmsFaqEntry.findById(req.params.id);
        if (!row) return res.status(404).json({ success: false, message: 'Not found' });
        return res.status(200).json({ success: true, data: row });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

function coerceFaqBody(body) {
    const b = { ...body };
    if (b.sortOrder != null) b.sortOrder = Number(b.sortOrder) || 0;
    if ('status' in b) b.status = b.status ? 1 : 0;
    return b;
}

exports.createCmsFaq = async (req, res) => {
    try {
        const body = coerceFaqBody(req.body);
        body.recordinfo = {
            createat: Date.now(),
            createby: req.user ? req.user.username : 'system',
        };
        const row = await CmsFaqEntry.create(body);
        return res.status(201).json({ success: true, data: row });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

exports.updateCmsFaq = async (req, res) => {
    try {
        const id = req.body._id || req.params.id;
        const body = coerceFaqBody(req.body);
        delete body._id;
        body.recordinfo = body.recordinfo || {};
        body.recordinfo.updateat = Date.now();
        body.recordinfo.updateby = req.user ? req.user.username : 'system';
        const row = await CmsFaqEntry.findByIdAndUpdate(id, body, { new: true, runValidators: true });
        if (!row) return res.status(404).json({ success: false, message: 'Not found' });
        return res.status(200).json({ success: true, data: row });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

exports.deleteCmsFaq = async (req, res) => {
    try {
        await CmsFaqEntry.findByIdAndDelete(req.body._id);
        return res.status(200).json({ success: true, message: 'Deleted' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
