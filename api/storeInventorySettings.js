const EcomProduct = require('../modal/ecomProduct');
const {
    StoreInventorySettings,
    getLowStockThreshold,
    ENV_FALLBACK,
    recalculateEcomLowStockFlags,
} = require('../modal/storeInventorySettings');

exports.getStoreInventorySettings = async (_req, res) => {
    try {
        const lowStockThreshold = await getLowStockThreshold();
        const lowStockSkuCount = await EcomProduct.countDocuments({
            stock: { $lt: lowStockThreshold },
            hidden: { $ne: true },
        });
        return res.status(200).json({
            success: true,
            data: {
                lowStockThreshold,
                lowStockSkuCount,
                envFallback: ENV_FALLBACK(),
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'settings_read_failed' });
    }
};

exports.updateStoreInventorySettings = async (req, res) => {
    try {
        const raw = req.body?.lowStockThreshold ?? req.body?.lowStockCount;
        if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) {
            return res.status(400).json({ success: false, message: 'lowStockThreshold is required (0–999999)' });
        }
        const lowStockThreshold = Math.max(0, Math.min(999999, Math.floor(Number(raw))));
        if (!Number.isFinite(lowStockThreshold)) {
            return res.status(400).json({ success: false, message: 'Invalid lowStockThreshold' });
        }

        let doc = await StoreInventorySettings.findOne();
        if (!doc) {
            doc = await StoreInventorySettings.create({ lowStockThreshold });
        } else {
            doc.lowStockThreshold = lowStockThreshold;
            doc.recordinfo = {
                ...(doc.recordinfo || {}),
                updateat: new Date(),
                updateby: req.user?.username || 'admin',
            };
            await doc.save();
        }

        await recalculateEcomLowStockFlags(lowStockThreshold);

        const lowStockSkuCount = await EcomProduct.countDocuments({
            stock: { $lt: lowStockThreshold },
            hidden: { $ne: true },
        });

        res.locals.auditDetails = `lowStockThreshold=${lowStockThreshold}`;

        return res.status(200).json({
            success: true,
            data: {
                lowStockThreshold,
                lowStockSkuCount,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'settings_update_failed' });
    }
};
