/**
 * 1) Strips embedded ORN reference from productname: "… (ORN-XXXX-0001)" → "…"
 * 2) Assigns productseries from Series Master for any product missing it.
 *
 * Prerequisite: node scripts/ensure-product-series-master.js (or manual Series Master for Product Master)
 *
 * Run: cd backend && node scripts/backfill-product-series-and-clean-names.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const ProductMaster = require('../modal/productmaster');
const { allocateNextProductSeriesCode } = require('../lib/productSeriesAllocator');

/** Matches trailing " (ORN-…)" from seed script */
const NAME_REF_SUFFIX = / \((ORN-[^)]+)\)\s*$/;

async function main() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error('MONGO_URI missing in backend/.env');
        process.exit(1);
    }

    await mongoose.connect(uri);

    const products = await ProductMaster.find({}).sort({ _id: 1 }).lean();
    console.log(`Processing ${products.length} products…`);

    let cleanedNames = 0;
    let assignedSeries = 0;
    let nameSkipped = 0;
    let errors = 0;

    for (const p of products) {
        const rawName = p.productname || '';
        const stripped = rawName.replace(NAME_REF_SUFFIX, '').trim();
        const needNameClean = stripped !== rawName && stripped.length > 0;

        let nextName = needNameClean ? stripped : null;
        let nextSeries = p.productseries && String(p.productseries).trim() ? null : null;

        if (!p.productseries || !String(p.productseries).trim()) {
            try {
                nextSeries = await allocateNextProductSeriesCode();
            } catch (e) {
                console.error(`Series allocation failed for ${p._id}:`, e.message);
                errors += 1;
                continue;
            }
        }

        const $set = {};
        if (nextName) $set.productname = nextName;
        if (nextSeries) $set.productseries = nextSeries;

        if (Object.keys($set).length === 0) continue;

        try {
            await ProductMaster.updateOne({ _id: p._id }, { $set });
            if (nextName) cleanedNames += 1;
            if (nextSeries) assignedSeries += 1;
        } catch (e) {
            if (e.code === 11000 && nextName) {
                try {
                    if (nextSeries) {
                        await ProductMaster.updateOne({ _id: p._id }, { $set: { productseries: nextSeries } });
                        assignedSeries += 1;
                    }
                    console.warn(
                        `Duplicate productname after clean — kept old name, set series only: _id=${p._id} name="${rawName.slice(0, 60)}…"`
                    );
                    nameSkipped += 1;
                } catch (e2) {
                    console.error(`Update failed ${p._id}:`, e2.message);
                    errors += 1;
                }
            } else {
                console.error(`Update failed ${p._id}:`, e.message);
                errors += 1;
            }
        }
    }

    console.log('Done.');
    console.log(`  Cleaned names: ${cleanedNames}`);
    console.log(`  Assigned productseries: ${assignedSeries}`);
    console.log(`  Name clean skipped (duplicate): ${nameSkipped}`);
    console.log(`  Errors: ${errors}`);
    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
