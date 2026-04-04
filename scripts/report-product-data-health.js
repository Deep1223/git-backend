/**
 * Report ProductMaster / EcomProduct data quality (missing series, names, catalog links).
 *
 * Run: cd backend && node scripts/report-product-data-health.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const ProductMaster = require('../modal/productmaster');
const EcomProduct = require('../modal/ecomProduct');

async function main() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error('MONGO_URI missing in backend/.env');
        process.exit(1);
    }
    await mongoose.connect(uri);

    const pmTotal = await ProductMaster.countDocuments({});
    const pmNoSeries = await ProductMaster.countDocuments({
        $or: [{ productseries: { $exists: false } }, { productseries: null }, { productseries: '' }],
    });
    const pmBadName = await ProductMaster.countDocuments({
        $or: [{ productname: { $exists: false } }, { productname: null }, { productname: '' }],
    });

    const ecomTotal = await EcomProduct.countDocuments({});
    const ecomNoMasterId = await EcomProduct.countDocuments({
        $or: [{ productMasterId: { $exists: false } }, { productMasterId: null }],
    });

    const names = await EcomProduct.distinct('name', { name: { $nin: [null, ''] } });
    const pmNames = new Set(
        (await ProductMaster.find({ productname: { $in: names } }).select('productname').lean()).map(
            (r) => r.productname
        )
    );
    let ecomWithoutPmByName = 0;
    for (const n of names) {
        if (!pmNames.has(n)) ecomWithoutPmByName += 1;
    }

    console.log('--- Product data health ---');
    console.log(`ProductMaster total: ${pmTotal}`);
    console.log(`ProductMaster missing productseries (empty/null): ${pmNoSeries}`);
    console.log(`ProductMaster missing productname: ${pmBadName}`);
    console.log(`EcomProduct total: ${ecomTotal}`);
    console.log(`EcomProduct missing productMasterId link: ${ecomNoMasterId}`);
    console.log(`Distinct Ecom names with no ProductMaster row with same productname: ${ecomWithoutPmByName}`);
    console.log('---');
    console.log('Fix steps:');
    console.log('  1) node scripts/link-ecom-catalog-to-product-master.js');
    console.log('  2) node scripts/backfill-product-series-and-clean-names.js');

    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
