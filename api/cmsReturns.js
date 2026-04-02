const CmsReturnsPage = require('../modal/cmsReturnsPage');

function linesToArray(val) {
    if (Array.isArray(val)) return val.map(String).filter(Boolean);
    if (typeof val === 'string') return val.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    return [];
}

function touchRecord(req, body, isNew) {
    if (!body.recordinfo) body.recordinfo = {};
    if (isNew) {
        body.recordinfo.createby = req.user ? req.user.username : 'system';
        body.recordinfo.createat = Date.now();
    }
    body.recordinfo.updateby = req.user ? req.user.username : 'system';
    body.recordinfo.updateat = Date.now();
}

function normalizeBody(body) {
    const b = { ...body };
    if ('eligibleText' in b) b.eligible = linesToArray(b.eligibleText);
    if ('notEligibleText' in b) b.notEligible = linesToArray(b.notEligibleText);
    if ('howToText' in b) b.howTo = linesToArray(b.howToText);
    delete b.eligibleText;
    delete b.notEligibleText;
    delete b.howToText;
    return b;
}

function withTextFields(doc) {
    if (!doc) return doc;
    const o = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    o.eligibleText = Array.isArray(o.eligible) ? o.eligible.join('\n') : '';
    o.notEligibleText = Array.isArray(o.notEligible) ? o.notEligible.join('\n') : '';
    o.howToText = Array.isArray(o.howTo) ? o.howTo.join('\n') : '';
    return o;
}

exports.getAllCmsReturns = async (req, res) => {
    try {
        const doc = await CmsReturnsPage.findOne({ singletonKey: 'main' }).lean();
        const row = doc ? withTextFields(doc) : null;
        const data = row ? [row] : [];
        return res.status(200).json({
            success: true,
            totalCount: data.length,
            count: data.length,
            data,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getCmsReturnsById = async (req, res) => {
    try {
        let doc = await CmsReturnsPage.findById(req.params.id).lean();
        if (!doc) doc = await CmsReturnsPage.findOne({ singletonKey: 'main' }).lean();
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        return res.status(200).json({ success: true, data: withTextFields(doc) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.createCmsReturns = async (req, res) => {
    try {
        const body = normalizeBody({ ...req.body });
        delete body._id;
        body.singletonKey = 'main';
        touchRecord(req, body, true);
        const doc = await CmsReturnsPage.findOneAndUpdate(
            { singletonKey: 'main' },
            { $set: body },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
        );
        return res.status(201).json({ success: true, data: withTextFields(doc) });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

exports.updateCmsReturns = async (req, res) => {
    try {
        const body = normalizeBody({ ...req.body });
        const id = body._id;
        delete body._id;
        body.singletonKey = 'main';
        touchRecord(req, body, false);
        let doc;
        if (id) {
            doc = await CmsReturnsPage.findByIdAndUpdate(id, { $set: body }, { new: true, runValidators: true });
        }
        if (!doc) {
            touchRecord(req, body, true);
            doc = await CmsReturnsPage.findOneAndUpdate(
                { singletonKey: 'main' },
                { $set: body },
                { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
            );
        }
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        return res.status(200).json({ success: true, data: withTextFields(doc) });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

exports.deleteCmsReturns = async (req, res) => {
    try {
        await CmsReturnsPage.deleteOne({ singletonKey: 'main' });
        return res.status(200).json({ success: true, message: 'Cleared' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
