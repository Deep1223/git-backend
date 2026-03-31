const GeneralSetting = require('../modal/generalsetting');

/**
 * Public storefront: latest general settings (single document).
 * Body mirrors dashboard listing POST: { paginationinfo, searchtext } — optional.
 */
exports.postPublicStoreSettings = async (req, res) => {
    try {
        const doc = await GeneralSetting.findOne()
            .sort({ 'recordinfo.updateat': -1, 'recordinfo.createat': -1 })
            .lean();

        if (!doc) {
            return res.status(200).json({
                success: true,
                message: 'No store settings configured',
                data: [],
                totalCount: 0,
                totalcount: 0,
                hasNextPage: false,
            });
        }

        res.status(200).json({
            success: true,
            data: [doc],
            totalCount: 1,
            totalcount: 1,
            hasNextPage: false,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};
