/**
 * Add a storefront homepage section key to Product Master rows (`storefrontHomeSectionKeys`)
 * so /promo?section=<key> lists them on the Orinket storefront.
 *
 * Default key: demiFineJewelleryProducts (Demifine “Shop collection” → /promo?section=demiFineJewelleryProducts).
 *
 * Run: cd backend && node scripts/backfill-storefront-section-products.js
 *
 * Env (optional):
 *   SECTION_KEY          — must match dashboard “Product Listed On” value (default demiFineJewelleryProducts)
 *   SECTION_PRODUCT_LIMIT — how many products to tag (default 30)
 *   SECTION_ONLY_IN_STOCK — set to 1 to only pick products with availableQty > 0
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const ProductMaster = require('../modal/productmaster');

const ALLOWED_KEYS = new Set([
    'demiFineJewelleryProducts',
    'topStylesProducts',
    'trendingProducts',
    'recommendedProducts',
    'fineGoldProducts',
]);

async function main() {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI missing in backend/.env');

    const sectionKey = String(process.env.SECTION_KEY || 'demiFineJewelleryProducts').trim();
    if (!ALLOWED_KEYS.has(sectionKey)) {
        throw new Error(
            `Invalid SECTION_KEY "${sectionKey}". Use one of: ${[...ALLOWED_KEYS].join(', ')}`
        );
    }

    const limit = Math.max(1, parseInt(process.env.SECTION_PRODUCT_LIMIT || '30', 10) || 30);
    const inStockOnly =
        process.env.SECTION_ONLY_IN_STOCK === '1' || process.env.SECTION_ONLY_IN_STOCK === 'true';

    await mongoose.connect(uri);

    /** Exclude rows that already list this section (array contains sectionKey). */
    const filter = {
        $nor: [{ storefrontHomeSectionKeys: sectionKey }],
    };
    if (inStockOnly) {
        filter.availableQty = { $gt: 0 };
    }

    const candidates = await ProductMaster.find(filter)
        .sort({ _id: 1 })
        .limit(limit)
        .select('_id productname storefrontHomeSectionKeys')
        .lean();

    if (!candidates.length) {
        console.log(`No products to update (all may already include ${sectionKey}).`);
        await mongoose.disconnect();
        return;
    }

    const ids = candidates.map((d) => d._id);
    const res = await ProductMaster.updateMany(
        { _id: { $in: ids } },
        { $addToSet: { storefrontHomeSectionKeys: sectionKey } }
    );

    console.log(
        `Added "${sectionKey}" to storefrontHomeSectionKeys on ${res.modifiedCount} product(s) (limit ${limit}, inStockOnly=${inStockOnly}).`
    );
    candidates.slice(0, 10).forEach((p) => {
        console.log(`  - ${p.productname}`);
    });
    if (candidates.length > 10) console.log(`  … and ${candidates.length - 10} more`);

    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
