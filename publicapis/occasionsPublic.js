const OccasionMaster = require('../modal/occasionmaster');

/**
 * POST /api/public/occasions
 * Active occasions for storefront carousel (no auth).
 */
exports.postPublicOccasions = async (req, res) => {
    try {
        const rows = await OccasionMaster.find({ status: 1 })
            .sort({ sortorder: 1, occasionname: 1 })
            .select('occasionname slug image description')
            .lean();

        res.status(200).json({
            success: true,
            totalCount: rows.length,
            count: rows.length,
            data: rows,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};
