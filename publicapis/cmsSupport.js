const CmsContactPage = require('../modal/cmsContactPage');
const CmsFaqEntry = require('../modal/cmsFaqEntry');
const CmsShippingPage = require('../modal/cmsShippingPage');
const CmsReturnsPage = require('../modal/cmsReturnsPage');

exports.postPublicCmsContact = async (req, res) => {
    try {
        const doc = await CmsContactPage.findOne({ singletonKey: 'main' }).lean();
        return res.status(200).json({ success: true, data: doc });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.postPublicCmsFaq = async (req, res) => {
    try {
        const rows = await CmsFaqEntry.find({ status: 1 }).sort({ sortOrder: 1, createdAt: 1 }).lean();
        return res.status(200).json({ success: true, data: rows });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.postPublicCmsShipping = async (req, res) => {
    try {
        const doc = await CmsShippingPage.findOne({ singletonKey: 'main' }).lean();
        return res.status(200).json({ success: true, data: doc });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.postPublicCmsReturns = async (req, res) => {
    try {
        const doc = await CmsReturnsPage.findOne({ singletonKey: 'main' }).lean();
        return res.status(200).json({ success: true, data: doc });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
