const CmsShippingPage = require('../modal/cmsShippingPage');

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
    if ('bulletsText' in b) {
        b.bullets = linesToArray(b.bulletsText);
    }
    delete b.bulletsText;
    if (!Array.isArray(b.zones)) b.zones = [];
    return b;
}

exports.getAllCmsShipping = async (req, res) => {
    try {
        const doc = await CmsShippingPage.findOne({ singletonKey: 'main' }).lean();
        if (doc) {
            doc.bulletsText = Array.isArray(doc.bullets) ? doc.bullets.join('\n') : '';
        }
        const data = doc ? [doc] : [];
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

exports.getCmsShippingById = async (req, res) => {
    try {
        let doc = await CmsShippingPage.findById(req.params.id).lean();
        if (!doc) doc = await CmsShippingPage.findOne({ singletonKey: 'main' }).lean();
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        doc.bulletsText = Array.isArray(doc.bullets) ? doc.bullets.join('\n') : '';
        return res.status(200).json({ success: true, data: doc });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.createCmsShipping = async (req, res) => {
    try {
        const body = normalizeBody({ ...req.body });
        delete body._id;
        body.singletonKey = 'main';
        touchRecord(req, body, true);
        const doc = await CmsShippingPage.findOneAndUpdate(
            { singletonKey: 'main' },
            { $set: body },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
        );
        const out = doc.toObject();
        out.bulletsText = Array.isArray(out.bullets) ? out.bullets.join('\n') : '';
        return res.status(201).json({ success: true, data: out });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

exports.updateCmsShipping = async (req, res) => {
    try {
        const body = normalizeBody({ ...req.body });
        const id = body._id;
        delete body._id;
        body.singletonKey = 'main';
        touchRecord(req, body, false);
        let doc;
        if (id) {
            doc = await CmsShippingPage.findByIdAndUpdate(id, { $set: body }, { new: true, runValidators: true });
        }
        if (!doc) {
            touchRecord(req, body, true);
            doc = await CmsShippingPage.findOneAndUpdate(
                { singletonKey: 'main' },
                { $set: body },
                { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
            );
        }
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        const out = doc.toObject ? doc.toObject() : doc;
        out.bulletsText = Array.isArray(out.bullets) ? out.bullets.join('\n') : '';
        return res.status(200).json({ success: true, data: out });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

exports.deleteCmsShipping = async (req, res) => {
    try {
        await CmsShippingPage.deleteOne({ singletonKey: 'main' });
        return res.status(200).json({ success: true, message: 'Cleared' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
