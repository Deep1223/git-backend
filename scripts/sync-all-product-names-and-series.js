/**
 * One-shot DB sync:
 * 1) Link every EcomProduct → ProductMaster (same as link-ecom-catalog-to-product-master.js)
 * 2) ProductMaster: strip trailing " (ORN-…)", title-case display name, assign missing productseries
 * 3) EcomProduct: set name from linked ProductMaster.productname (storefront shows same name as master)
 *
 * Run: cd backend && node scripts/sync-all-product-names-and-series.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const ProductMaster = require('../modal/productmaster');
const EcomProduct = require('../modal/ecomProduct');
const EcomCategory = require('../modal/ecomCategory');
const CategoryMaster = require('../modal/categorymaster');
const { allocateNextProductSeriesCode } = require('../lib/productSeriesAllocator');
const {
    resolveCategoryMasterIdFromEcomCategory,
    findOrCreateProductMasterForCatalogProduct,
    mirrorAvailableQtyFromEcomProduct,
} = require('../lib/catalogProductMasterSync');

const NAME_REF_SUFFIX = / \((ORN-[^)]+)\)\s*$/;

function properDisplayName(name) {
    const s = String(name ?? '')
        .replace(NAME_REF_SUFFIX, '')
        .trim()
        .replace(/\s+/g, ' ');
    if (!s) return '';
    return s
        .split(/\s+/)
        .map((w) => {
            if (!w) return w;
            return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        })
        .join(' ');
}

async function linkAllCatalog() {
    const fallbackCat = await CategoryMaster.findOne({ status: 1 }).sort({ categoryname: 1 }).select('_id').lean();
    if (!fallbackCat) {
        throw new Error('No active Category Master row; add at least one category first.');
    }

    const all = await EcomProduct.find({}).sort({ _id: 1 });
    let ok = 0;
    let errors = 0;

    for (const ep of all) {
        const cat = await EcomCategory.findById(ep.category).lean();
        if (!cat) {
            console.warn(`Skip link ${ep.slug}: missing EcomCategory`);
            errors += 1;
            continue;
        }
        try {
            const resolvedCat = await resolveCategoryMasterIdFromEcomCategory(cat);
            if (!resolvedCat) {
                console.warn(`No Category Master for "${cat.slug}" — using fallback _id=${fallbackCat._id}`);
            }
            const pm = await findOrCreateProductMasterForCatalogProduct({
                name: ep.name,
                slug: ep.slug,
                price: ep.price,
                originalPrice: ep.originalPrice,
                images: ep.images,
                stock: ep.stock,
                ecomCategory: cat,
                createdBy: 'script:sync-all-product-names-and-series',
                existingProductMasterId: ep.productMasterId || null,
                fallbackCategoryMasterId: fallbackCat._id,
            });
            await EcomProduct.updateOne({ _id: ep._id }, { $set: { productMasterId: pm._id } });
            await mirrorAvailableQtyFromEcomProduct(ep._id);
            ok += 1;
        } catch (e) {
            console.error(`Link fail ${ep.slug}:`, e.message);
            errors += 1;
        }
    }

    console.log(`[link] catalog rows: ${ok} ok, ${errors} errors`);
}

async function fixProductMasterNamesAndSeries() {
    const products = await ProductMaster.find({}).sort({ _id: 1 }).lean();
    let renamed = 0;
    let seriesAssigned = 0;
    let renameSkipped = 0;
    let errors = 0;

    for (const p of products) {
        const raw = p.productname || '';
        const stripped = raw.replace(NAME_REF_SUFFIX, '').trim();
        const nextName = properDisplayName(stripped || raw);
        let nextSeries = null;

        if (!p.productseries || !String(p.productseries).trim()) {
            try {
                nextSeries = await allocateNextProductSeriesCode();
            } catch (e) {
                console.error(`Series failed for ${p._id}:`, e.message);
                errors += 1;
                continue;
            }
        }

        const $set = {};
        if (nextName && nextName !== raw) {
            const clash = await ProductMaster.findOne({
                productname: nextName,
                _id: { $ne: p._id },
            })
                .select('_id')
                .lean();
            if (clash) {
                console.warn(`Skip rename (duplicate name): _id=${p._id} wanted "${nextName}"`);
                renameSkipped += 1;
            } else {
                $set.productname = nextName;
            }
        }
        if (nextSeries) $set.productseries = nextSeries;

        if (Object.keys($set).length === 0) continue;

        try {
            await ProductMaster.updateOne({ _id: p._id }, { $set });
            if ($set.productname) renamed += 1;
            if ($set.productseries) seriesAssigned += 1;
        } catch (e) {
            if (e.code === 11000) {
                console.warn(`Skip update (11000): _id=${p._id}`, e.message);
                renameSkipped += 1;
            } else {
                console.error(`Update failed ${p._id}:`, e.message);
                errors += 1;
            }
        }
    }

    console.log(
        `[productmaster] renamed: ${renamed}, series assigned: ${seriesAssigned}, rename skipped: ${renameSkipped}, errors: ${errors}`
    );
}

async function syncEcomNamesFromMaster() {
    const linked = await EcomProduct.find({ productMasterId: { $ne: null } }).select('name productMasterId').lean();
    let updated = 0;
    for (const ep of linked) {
        const pm = await ProductMaster.findById(ep.productMasterId).select('productname').lean();
        if (!pm?.productname) continue;
        if (ep.name === pm.productname) continue;
        await EcomProduct.updateOne({ _id: ep._id }, { $set: { name: pm.productname } });
        updated += 1;
    }
    console.log(`[ecom] names synced from ProductMaster: ${updated}`);
}

async function main() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error('MONGO_URI missing in backend/.env');
        process.exit(1);
    }
    await mongoose.connect(uri);

    console.log('=== sync-all-product-names-and-series ===');
    await linkAllCatalog();
    await fixProductMasterNamesAndSeries();
    await syncEcomNamesFromMaster();
    console.log('=== done ===');

    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
