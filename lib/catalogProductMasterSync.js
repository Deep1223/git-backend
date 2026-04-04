/**
 * Keeps storefront catalog (EcomProduct) tied to ProductMaster: series, single source of truth.
 */
const mongoose = require('mongoose');
const ProductMaster = require('../modal/productmaster');
const EcomProduct = require('../modal/ecomProduct');
const CategoryMaster = require('../modal/categorymaster');
const { getLowStockThreshold, recalculateEcomLowStockFlags } = require('../modal/storeInventorySettings');
const { slugifyLabel } = require('./slugifyLabel');

/**
 * @param {{ name?: string, slug?: string }} ecomCategory — lean doc
 * @returns {Promise<mongoose.Types.ObjectId|null>}
 */
function slugMatchesCategoryTab(catSlugified, tabSlug) {
    const t = String(tabSlug || '').trim().toLowerCase();
    const c = String(catSlugified || '').trim().toLowerCase();
    if (!t || !c) return false;
    if (c === t) return true;
    const men = new Set(['men', 'mens']);
    if (men.has(t) && men.has(c)) return true;
    return false;
}

/**
 * @param {{ slug?: string, name?: string }} ecomCategory
 * @param {{ includeInactive?: boolean }} [options] — if true, also match CategoryMaster with status !== 1
 */
async function resolveCategoryMasterIdFromEcomCategory(ecomCategory, options = {}) {
    if (!ecomCategory) return null;
    const targetSlug = String(ecomCategory.slug || '').trim().toLowerCase();
    const targetName = String(ecomCategory.name || '').trim().toLowerCase();
    const filter = options.includeInactive ? {} : { status: 1 };
    const cats = await CategoryMaster.find(filter).select('_id categoryname').lean();

    for (const c of cats) {
        if (slugMatchesCategoryTab(slugifyLabel(c.categoryname), targetSlug)) return c._id;
    }
    for (const c of cats) {
        if (String(c.categoryname || '').trim().toLowerCase() === targetName) return c._id;
    }

    if (!options.includeInactive) {
        return resolveCategoryMasterIdFromEcomCategory(ecomCategory, { includeInactive: true });
    }

    return null;
}

function normalizeTitleName(name) {
    const t = String(name ?? '').trim();
    return t.replace(/\s+/g, ' ');
}

function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Create or update ProductMaster for a catalog row. New docs get productseries via model pre-save.
 *
 * @param {object} opts
 * @param {string} opts.name
 * @param {string} [opts.slug]
 * @param {number} opts.price
 * @param {number} opts.originalPrice
 * @param {string[]} [opts.images]
 * @param {number} opts.stock
 * @param {object} opts.ecomCategory — EcomCategory lean doc (name, slug)
 * @param {string} [opts.createdBy]
 * @param {string|null} [opts.existingProductMasterId] — prefer update this row (catalog already linked)
 * @param {string|null} [opts.fallbackCategoryMasterId] — use only for migrations if slug does not match any category
 */
async function findOrCreateProductMasterForCatalogProduct(opts) {
    const name = normalizeTitleName(opts.name);
    if (!name) {
        throw new Error('Product name is required');
    }

    let categoryid = await resolveCategoryMasterIdFromEcomCategory(opts.ecomCategory);
    if (!categoryid && opts.fallbackCategoryMasterId) {
        categoryid = opts.fallbackCategoryMasterId;
    }
    if (!categoryid) {
        const hint = opts.ecomCategory?.slug || opts.ecomCategory?.name || 'unknown';
        throw new Error(
            `No Category Master matches storefront category "${hint}". Add a Category Master whose slug matches (e.g. same name as "${hint}").`
        );
    }

    const catDoc = await CategoryMaster.findById(categoryid).select('categoryname').lean();
    const categoryLabel = catDoc?.categoryname || opts.ecomCategory?.name || '';

    const price = Math.max(0, Number(opts.price) || 0);
    const originalPrice = Math.max(0, Number(opts.originalPrice != null ? opts.originalPrice : opts.price) || 0);
    const stock = Math.max(0, Math.floor(Number(opts.stock) || 0));
    const images = Array.isArray(opts.images) ? opts.images.filter((u) => u != null && String(u).trim() !== '') : [];

    let pm =
        opts.existingProductMasterId != null
            ? await ProductMaster.findById(opts.existingProductMasterId)
            : null;

    if (!pm) {
        pm = await ProductMaster.findOne({ productname: name });
    }
    if (!pm) {
        pm = await ProductMaster.findOne({
            productname: new RegExp(`^${escapeRegex(name)}$`, 'i'),
        });
    }

    if (!pm) {
        pm = await ProductMaster.create({
            productname: name,
            price,
            originalPrice,
            categoryid,
            category: categoryLabel,
            images,
            availableQty: stock,
            description: opts.slug ? `Storefront slug: ${opts.slug}` : '',
            recordinfo: {
                createby: opts.createdBy || 'catalog-sync',
            },
        });
        return pm;
    }

    pm.productname = name;
    pm.price = price;
    pm.originalPrice = originalPrice;
    pm.categoryid = categoryid;
    pm.category = categoryLabel;
    if (images.length) pm.images = images;
    pm.availableQty = stock;
    if (!pm.recordinfo) pm.recordinfo = {};
    pm.recordinfo.updateby = opts.createdBy || 'catalog-sync';
    pm.recordinfo.updateat = new Date();
    await pm.save();
    return pm;
}

/**
 * Set ProductMaster.availableQty to match EcomProduct.stock (and instock flag).
 */
async function mirrorAvailableQtyFromEcomProduct(ecomProductId) {
    const ep = await EcomProduct.findById(ecomProductId).select('stock productMasterId').lean();
    if (!ep?.productMasterId) return;
    const stock = Math.max(0, Math.floor(Number(ep.stock) || 0));
    await ProductMaster.findByIdAndUpdate(ep.productMasterId, {
        $set: {
            availableQty: stock,
            instock: stock > 0 ? 1 : 0,
        },
    });
}

/**
 * After Product Master save: copy canonical fields into every linked EcomProduct (DB + storefront stay aligned).
 */
async function syncLinkedCatalogFromProductMaster(pmDoc) {
    const pm = pmDoc && typeof pmDoc.toObject === 'function' ? pmDoc.toObject() : pmDoc;
    if (!pm || !pm._id) return { matched: 0, modified: 0 };

    const stock = Math.max(0, Math.floor(Number(pm.availableQty) || 0));
    const images = Array.isArray(pm.images)
        ? pm.images.filter((u) => u != null && String(u).trim() !== '')
        : [];
    const threshold = await getLowStockThreshold();
    const $set = {
        price: Math.max(0, Number(pm.price) || 0),
        originalPrice: Math.max(0, Number(pm.originalPrice) || 0),
        images,
        stock,
        isLowStock: stock < threshold,
    };
    const pn = String(pm.productname || '').trim();
    if (pn) $set.name = pn;

    const result = await EcomProduct.updateMany({ productMasterId: pm._id }, { $set });
    await recalculateEcomLowStockFlags(threshold);
    return {
        matched: result.matchedCount ?? result.n ?? 0,
        modified: result.modifiedCount ?? result.nModified ?? 0,
    };
}

module.exports = {
    resolveCategoryMasterIdFromEcomCategory,
    findOrCreateProductMasterForCatalogProduct,
    mirrorAvailableQtyFromEcomProduct,
    syncLinkedCatalogFromProductMaster,
    normalizeTitleName,
};
