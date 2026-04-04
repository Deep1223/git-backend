const mongoose = require('mongoose');
const EcomProduct = require('./ecomProduct');

const storeInventorySettingsSchema = new mongoose.Schema(
    {
        /** Single row: catalog-wide “units below this = low stock” for e-com SKUs + notifications. */
        lowStockThreshold: {
            type: Number,
            default: 5,
            min: 0,
            max: 999999,
        },
        recordinfo: {
            updateat: { type: Date },
            updateby: { type: String },
        },
    },
    { timestamps: true }
);

const StoreInventorySettings = mongoose.model('StoreInventorySettings', storeInventorySettingsSchema);

const ENV_FALLBACK = () => Math.max(0, Math.floor(Number(process.env.LOW_STOCK_THRESHOLD || 5)));

/**
 * Returns persisted threshold, creating default doc if missing.
 */
async function getLowStockThreshold() {
    let doc = await StoreInventorySettings.findOne();
    if (!doc) {
        doc = await StoreInventorySettings.create({ lowStockThreshold: ENV_FALLBACK() });
    }
    const n = Number(doc.lowStockThreshold);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : ENV_FALLBACK();
}

async function recalculateEcomLowStockFlags(threshold) {
    const t = Math.max(0, Math.floor(Number(threshold)));
    await EcomProduct.updateMany({ stock: { $lt: t } }, { $set: { isLowStock: true } });
    await EcomProduct.updateMany({ stock: { $gte: t } }, { $set: { isLowStock: false } });
}

module.exports = {
    StoreInventorySettings,
    getLowStockThreshold,
    ENV_FALLBACK,
    recalculateEcomLowStockFlags,
};
