/**
 * Ensures a Series Master row exists for Product Master (auto product codes).
 *
 * Run: cd backend && node scripts/ensure-product-series-master.js
 *
 * Requires: Menu Master entry for Product (aliasname productmaster or name Product Master).
 * If a series for Product Master already exists, exits without changes.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const MenuMaster = require('../modal/menumaster');
const SeriesMaster = require('../modal/seriesmaster');
const { getProductSeriesMaster } = require('../lib/productSeriesAllocator');

const DEFAULT_SERIES = {
    seriesname: 'Product Master Auto Series',
    seriescode: 'ORP',
    startingnumber: 1,
    currentnumber: 0,
    numberlength: 6,
    separator: '-',
    suffix: '',
    status: 1,
    recordinfo: {
        createby: 'ensure-product-series-master',
        createat: new Date(),
    },
};

async function main() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error('MONGO_URI missing in backend/.env');
        process.exit(1);
    }

    await mongoose.connect(uri);

    const existing = await getProductSeriesMaster();
    if (existing) {
        console.log('Product series master already exists:', existing.seriescode, 'currentnumber=', existing.currentnumber);
        await mongoose.disconnect();
        return;
    }

    const menu = await MenuMaster.findOne({
        status: 1,
        $or: [{ aliasname: 'productmaster' }, { menuname: /^Product Master$/i }],
    });

    if (!menu) {
        console.error(
            'No Menu Master found for Product (aliasname "productmaster" or menuname "Product Master"). Create the menu first.'
        );
        await mongoose.disconnect();
        process.exit(1);
    }

    const clashCode = await SeriesMaster.findOne({ seriescode: DEFAULT_SERIES.seriescode });
    if (clashCode) {
        console.error(
            `Series code "${DEFAULT_SERIES.seriescode}" is already used. Create Product series manually in Series Master (Menu = "${menu.menuname}") with a different series code.`
        );
        await mongoose.disconnect();
        process.exit(1);
    }

    const clashName = await SeriesMaster.findOne({ seriesname: DEFAULT_SERIES.seriesname });
    if (clashName) {
        console.error(
            `Series name "${DEFAULT_SERIES.seriesname}" already exists. Update DEFAULT_SERIES.seriesname in this script or add Product series via dashboard.`
        );
        await mongoose.disconnect();
        process.exit(1);
    }

    const row = await SeriesMaster.create({
        menunameid: menu._id,
        menuname: menu.menuname,
        ...DEFAULT_SERIES,
    });

    console.log('Created Product series master:', row._id.toString(), row.seriescode, 'Menu:', row.menuname);
    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
