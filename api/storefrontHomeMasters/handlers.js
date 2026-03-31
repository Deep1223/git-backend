const GeneralSetting = require('../../modal/generalsetting');
const { parseCms, setRecordInfo } = require('./helpers');
const { getDef } = require('./definitions');

async function getLatestSetting() {
    return GeneralSetting.findOne().sort({ 'recordinfo.createat': -1 });
}

function makeRow(doc, alias, def) {
    const cms = parseCms(doc?.storefrontContentJson);
    const section = cms[def.cmsKey] && typeof cms[def.cmsKey] === 'object' ? cms[def.cmsKey] : {};
    return { _id: doc?._id, ...def.read(section), alias };
}

async function ensureSettingDoc(username) {
    let doc = await getLatestSetting();
    if (doc) return doc;
    doc = await GeneralSetting.create({
        storeName: 'ORINKET',
        recordinfo: { createby: username || 'system' },
        storefrontContentJson: JSON.stringify({}, null, 2),
    });
    return doc;
}

exports.getStorefrontMasterList = (alias) => async (req, res) => {
    try {
        const def = getDef(alias);
        if (!def) return res.status(404).json({ success: false, message: 'Master not found' });
        const doc = await getLatestSetting();
        if (!doc) {
            return res.status(200).json({ success: true, totalCount: 0, count: 0, data: [] });
        }
        const row = makeRow(doc, alias, def);
        return res.status(200).json({ success: true, totalCount: 1, count: 1, data: [row] });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

exports.getStorefrontMasterById = (alias) => async (req, res) => {
    try {
        const def = getDef(alias);
        if (!def) return res.status(404).json({ success: false, message: 'Master not found' });
        const doc = await getLatestSetting();
        if (!doc) return res.status(404).json({ success: false, message: 'Storefront master not found' });
        const row = makeRow(doc, alias, def);
        return res.status(200).json({ success: true, data: row });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

exports.createStorefrontMaster = (alias) => async (req, res) => {
    try {
        const def = getDef(alias);
        if (!def) return res.status(404).json({ success: false, message: 'Master not found' });

        const doc = await ensureSettingDoc(req.user ? req.user.username : 'system');
        const cms = parseCms(doc.storefrontContentJson);
        cms[def.cmsKey] = def.write(req.body || {});
        doc.storefrontContentJson = JSON.stringify(cms, null, 2);
        setRecordInfo(doc, req.user ? req.user.username : 'system');
        await doc.save();

        return res.status(201).json({ success: true, data: makeRow(doc, alias, def) });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

exports.updateStorefrontMaster = (alias) => async (req, res) => {
    try {
        const def = getDef(alias);
        if (!def) return res.status(404).json({ success: false, message: 'Master not found' });

        const doc = await ensureSettingDoc(req.user ? req.user.username : 'system');
        const cms = parseCms(doc.storefrontContentJson);
        cms[def.cmsKey] = def.write(req.body || {});
        doc.storefrontContentJson = JSON.stringify(cms, null, 2);
        setRecordInfo(doc, req.user ? req.user.username : 'system');
        await doc.save();

        return res.status(200).json({ success: true, data: makeRow(doc, alias, def) });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

exports.deleteStorefrontMaster = (alias) => async (req, res) => {
    try {
        const def = getDef(alias);
        if (!def) return res.status(404).json({ success: false, message: 'Master not found' });
        const doc = await getLatestSetting();
        if (!doc) return res.status(200).json({ success: true, message: 'No data to delete' });

        const cms = parseCms(doc.storefrontContentJson);
        delete cms[def.cmsKey];
        doc.storefrontContentJson = JSON.stringify(cms, null, 2);
        setRecordInfo(doc, req.user ? req.user.username : 'system');
        await doc.save();

        return res.status(200).json({ success: true, message: 'Storefront section cleared' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};
