/**
 * Allocates the next product series code from Series Master (Menu = Product Master).
 * Series row must exist: Series Master → Menu = "Product Master" (or alias productmaster menu).
 */
const SeriesMaster = require('../modal/seriesmaster');

/** Match Series Master rows tied to the Product Master screen */
const PRODUCT_SERIES_FILTER = {
    status: 1,
    menuname: /^Product Master$/i,
};

/**
 * @returns {Promise<string>} e.g. ORN-000001
 */
async function allocateNextProductSeriesCode() {
    const updated = await SeriesMaster.findOneAndUpdate(
        PRODUCT_SERIES_FILTER,
        {
            $inc: { currentnumber: 1 },
            $set: { 'recordinfo.updateat': new Date() },
        },
        { new: true }
    );

    if (!updated) {
        throw new Error(
            'No active Series Master for products. In dashboard: Series Master → add row with Menu "Product Master", Series Code, Number Length, etc. Or run: node scripts/ensure-product-series-master.js'
        );
    }

    const n = String(updated.currentnumber).padStart(updated.numberlength || 4, '0');
    const sep = updated.separator != null ? updated.separator : '-';
    return `${updated.seriescode}${sep}${n}${updated.suffix || ''}`;
}

async function getProductSeriesMaster() {
    return SeriesMaster.findOne(PRODUCT_SERIES_FILTER).lean();
}

/**
 * Next code if a product were saved now (does not increment — for UI preview only).
 */
function formatProductSeriesFromDoc(sm) {
    if (!sm) return null;
    const nextNum = (sm.currentnumber ?? 0) + 1;
    const n = String(nextNum).padStart(sm.numberlength || 4, '0');
    const sep = sm.separator != null ? sm.separator : '-';
    return `${sm.seriescode}${sep}${n}${sm.suffix || ''}`;
}

async function getPreviewNextProductSeriesCode() {
    const sm = await getProductSeriesMaster();
    if (!sm) return null;
    return formatProductSeriesFromDoc(sm);
}

module.exports = {
    allocateNextProductSeriesCode,
    getProductSeriesMaster,
    getPreviewNextProductSeriesCode,
    PRODUCT_SERIES_FILTER,
};
