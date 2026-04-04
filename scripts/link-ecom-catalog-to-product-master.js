/**
 * For every storefront SKU: ensure ProductMaster row + set EcomProduct.productMasterId + mirror stock.
 * Requires Category Master rows that match EcomCategory slugs (see catalogProductMasterSync).
 *
 * Run: cd backend && node scripts/link-ecom-catalog-to-product-master.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const EcomProduct = require('../modal/ecomProduct');
const EcomCategory = require('../modal/ecomCategory');
const CategoryMaster = require('../modal/categorymaster');
const {
    resolveCategoryMasterIdFromEcomCategory,
    findOrCreateProductMasterForCatalogProduct,
    mirrorAvailableQtyFromEcomProduct,
} = require('../lib/catalogProductMasterSync');

async function main() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error('MONGO_URI missing in backend/.env');
        process.exit(1);
    }
    await mongoose.connect(uri);

    const fallbackCat = await CategoryMaster.findOne({ status: 1 }).sort({ categoryname: 1 }).select('_id').lean();
    if (!fallbackCat) {
        console.error('No active Category Master row; add at least one category before linking.');
        process.exit(1);
    }

    const all = await EcomProduct.find({}).sort({ _id: 1 });
    console.log(`Linking ${all.length} catalog product(s) to ProductMaster…`);

    let ok = 0;
    let errors = 0;

    for (const ep of all) {
        const cat = await EcomCategory.findById(ep.category).lean();
        if (!cat) {
            console.warn(`Skip ${ep.slug}: missing EcomCategory`);
            errors += 1;
            continue;
        }
        try {
            const resolvedCat = await resolveCategoryMasterIdFromEcomCategory(cat);
            if (!resolvedCat) {
                console.warn(`No Category Master for storefront slug "${cat.slug}" — using fallback category _id=${fallbackCat._id}`);
            }
            const pm = await findOrCreateProductMasterForCatalogProduct({
                name: ep.name,
                slug: ep.slug,
                price: ep.price,
                originalPrice: ep.originalPrice,
                images: ep.images,
                stock: ep.stock,
                ecomCategory: cat,
                createdBy: 'script:link-ecom-catalog-to-product-master',
                existingProductMasterId: ep.productMasterId || null,
                fallbackCategoryMasterId: fallbackCat._id,
            });
            await EcomProduct.updateOne({ _id: ep._id }, { $set: { productMasterId: pm._id } });
            await mirrorAvailableQtyFromEcomProduct(ep._id);
            ok += 1;
        } catch (e) {
            console.error(`Fail ${ep.slug}:`, e.message);
            errors += 1;
        }
    }

    console.log(`Done. Linked/updated: ${ok}, errors: ${errors}`);
    console.log('If any ProductMaster still lack productseries, run: node scripts/backfill-product-series-and-clean-names.js');

    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
