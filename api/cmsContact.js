const CmsContactPage = require('../modal/cmsContactPage');

function touchRecord(req, body, isNew) {
    if (!body.recordinfo) body.recordinfo = {};
    if (isNew) {
        body.recordinfo.createby = req.user ? req.user.username : 'system';
        body.recordinfo.createat = Date.now();
    }
    body.recordinfo.updateby = req.user ? req.user.username : 'system';
    body.recordinfo.updateat = Date.now();
}

exports.getAllCmsContact = async (req, res) => {
    try {
        const doc = await CmsContactPage.findOne({ singletonKey: 'main' }).lean();
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

exports.getCmsContactById = async (req, res) => {
    try {
        const doc = await CmsContactPage.findById(req.params.id).lean();
        if (!doc) {
            const fallback = await CmsContactPage.findOne({ singletonKey: 'main' }).lean();
            if (!fallback) return res.status(404).json({ success: false, message: 'Not found' });
            return res.status(200).json({ success: true, data: fallback });
        }
        return res.status(200).json({ success: true, data: doc });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.createCmsContact = async (req, res) => {
    try {
        const body = { ...req.body };
        delete body._id;
        body.singletonKey = 'main';
        touchRecord(req, body, true);
        const doc = await CmsContactPage.findOneAndUpdate(
            { singletonKey: 'main' },
            { $set: body },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
        );
        return res.status(201).json({ success: true, data: doc });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

exports.updateCmsContact = async (req, res) => {
    try {
        const body = { ...req.body };
        const id = body._id;
        delete body._id;
        body.singletonKey = 'main';
        touchRecord(req, body, false);
        let doc;
        if (id) {
            doc = await CmsContactPage.findByIdAndUpdate(id, { $set: body }, { new: true, runValidators: true });
        }
        if (!doc) {
            touchRecord(req, body, true);
            doc = await CmsContactPage.findOneAndUpdate(
                { singletonKey: 'main' },
                { $set: body },
                { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
            );
        }
        if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
        return res.status(200).json({ success: true, data: doc });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

exports.deleteCmsContact = async (req, res) => {
    try {
        await CmsContactPage.deleteOne({ singletonKey: 'main' });
        return res.status(200).json({ success: true, message: 'Cleared' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
