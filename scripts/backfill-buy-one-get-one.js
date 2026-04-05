/**
 * Set buyOneGetOneFree=true on a batch of Product Master rows so /promo?offer=bogo has data.
 *
 * Schema field: modal/productmaster.js → buyOneGetOneFree (Boolean, default false).
 *
 * Run: cd backend && node scripts/backfill-buy-one-get-one.js
 *
 * Env (optional):
 *   BOGO_PRODUCT_LIMIT   — how many products to flag (default 25)
 *   BOGO_ONLY_IN_STOCK=1 — only products with availableQty > 0
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const ProductMaster = require('../modal/productmaster');

async function main() {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI missing in backend/.env');

    const limit = Math.max(1, parseInt(process.env.BOGO_PRODUCT_LIMIT || '25', 10) || 25);
    const inStockOnly = process.env.BOGO_ONLY_IN_STOCK === '1' || process.env.BOGO_ONLY_IN_STOCK === 'true';

    await mongoose.connect(uri);

    const filter = {
        buyOneGetOneFree: { $ne: true },
    };
    if (inStockOnly) {
        filter.availableQty = { $gt: 0 };
    }

    const candidates = await ProductMaster.find(filter)
        .sort({ _id: 1 })
        .limit(limit)
        .select('_id productname')
        .lean();

    if (!candidates.length) {
        console.log('No matching products found (all may already be BOGO or filter too strict).');
        await mongoose.disconnect();
        return;
    }

    const ids = candidates.map((d) => d._id);
    const res = await ProductMaster.updateMany({ _id: { $in: ids } }, { $set: { buyOneGetOneFree: true } });

    console.log(`Updated buyOneGetOneFree=true on ${res.modifiedCount} product(s) (limit ${limit}, inStockOnly=${inStockOnly}).`);
    candidates.slice(0, 8).forEach((p) => {
        console.log(`  - ${p.productname}`);
    });
    if (candidates.length > 8) console.log(`  … and ${candidates.length - 8} more`);

    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
