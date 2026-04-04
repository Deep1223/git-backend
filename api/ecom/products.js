const EcomProduct = require('../../modal/ecomProduct');
const EcomCategory = require('../../modal/ecomCategory');
const { mapProductPublic, PRODUCT_MASTER_PUBLIC_SELECT } = require('./helpers');
const {
    findOrCreateProductMasterForCatalogProduct,
    mirrorAvailableQtyFromEcomProduct,
} = require('../../lib/catalogProductMasterSync');

exports.listProducts = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.min(1000, Math.max(1, Number(req.query.limit || 20)));
        const skip = (page - 1) * limit;
        const categorySlug = req.query.category ? String(req.query.category) : null;
        const search = req.query.search ? String(req.query.search).trim() : '';

        const filter = { hidden: { $ne: true } };
        if (categorySlug) {
            const cat = await EcomCategory.findOne({ slug: categorySlug }).select('_id').lean();
            if (!cat) {
                return res.status(200).json({ success: true, data: [], page, limit, totalCount: 0 });
            }
            filter.category = cat._id;
        }
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { tags: { $in: [new RegExp(search, 'i')] } },
            ];
        }

        const query = EcomProduct.find(filter)
            .populate('category', 'name slug')
            .populate('productMasterId', PRODUCT_MASTER_PUBLIC_SELECT)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const docs = await query.lean();
        const data = docs.filter((d) => d.category).map(mapProductPublic);
        const totalCount = await EcomProduct.countDocuments(filter);
        return res.status(200).json({ success: true, data, page, limit, totalCount });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'products_failed' });
    }
};

exports.getProduct = async (req, res) => {
    try {
        const doc = await EcomProduct.findById(req.params.id)
            .populate('category', 'name slug')
            .populate('productMasterId', PRODUCT_MASTER_PUBLIC_SELECT)
            .lean();
        if (!doc || doc.hidden) return res.status(404).json({ success: false, message: 'Product not found' });
        return res.status(200).json({ success: true, data: mapProductPublic(doc) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'product_failed' });
    }
};

exports.createProduct = async (req, res) => {
    try {
        const payload = req.body || {};
        const category = await EcomCategory.findById(payload.category).lean();
        if (!category) {
            return res.status(400).json({ success: false, message: 'Invalid category' });
        }

        const pm = await findOrCreateProductMasterForCatalogProduct({
            name: payload.name,
            slug: payload.slug,
            price: payload.price,
            originalPrice: payload.originalPrice,
            images: payload.images,
            stock: payload.stock,
            ecomCategory: category,
            createdBy: req.ecomUser?.email || req.ecomUser?.name || 'ecom-api',
        });

        const { productMasterId: _pmIgnore, ...catalogFields } = payload;
        const created = await EcomProduct.create({
            ...catalogFields,
            productMasterId: pm._id,
        });
        await mirrorAvailableQtyFromEcomProduct(created._id);

        const populated = await EcomProduct.findById(created._id)
            .populate('category', 'name slug')
            .populate('productMasterId', PRODUCT_MASTER_PUBLIC_SELECT)
            .lean();

        return res.status(201).json({ success: true, data: mapProductPublic(populated) });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Slug or unique field already exists' });
        }
        return res.status(500).json({ success: false, message: error.message || 'product_create_failed' });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const prev = await EcomProduct.findById(req.params.id).lean();
        if (!prev) return res.status(404).json({ success: false, message: 'Product not found' });

        const body = { ...(req.body || {}) };
        delete body.productMasterId;

        const nextCategoryId = body.category != null ? body.category : prev.category;
        const category = await EcomCategory.findById(nextCategoryId).lean();
        if (!category) {
            return res.status(400).json({ success: false, message: 'Invalid category' });
        }

        const nextName = body.name != null ? String(body.name).trim() : prev.name;
        const nextSlug = body.slug != null ? String(body.slug).trim() : prev.slug;
        const nextPrice = body.price != null ? Number(body.price) : prev.price;
        const nextOriginal =
            body.originalPrice != null ? Number(body.originalPrice) : prev.originalPrice;
        const nextStock = body.stock != null ? body.stock : prev.stock;
        const nextImages = body.images != null ? body.images : prev.images;

        const pm = await findOrCreateProductMasterForCatalogProduct({
            name: nextName,
            slug: nextSlug,
            price: nextPrice,
            originalPrice: nextOriginal,
            images: nextImages,
            stock: nextStock,
            ecomCategory: category,
            createdBy: req.ecomUser?.email || req.ecomUser?.name || 'ecom-api',
            existingProductMasterId: prev.productMasterId || null,
        });
        productMasterId = pm._id;
        body.productMasterId = productMasterId;

        const updated = await EcomProduct.findByIdAndUpdate(req.params.id, body, { new: true });
        if (!updated) return res.status(404).json({ success: false, message: 'Product not found' });

        await mirrorAvailableQtyFromEcomProduct(updated._id);

        const populated = await EcomProduct.findById(updated._id)
            .populate('category', 'name slug')
            .populate('productMasterId', PRODUCT_MASTER_PUBLIC_SELECT)
            .lean();

        return res.status(200).json({ success: true, data: mapProductPublic(populated) });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Slug or unique field conflict' });
        }
        return res.status(500).json({ success: false, message: error.message || 'product_update_failed' });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const deleted = await EcomProduct.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, message: 'Product not found' });
        return res.status(200).json({ success: true, message: 'Product deleted' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'product_delete_failed' });
    }
};

exports.trackProductView = async (req, res) => {
    try {
        await EcomProduct.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'track_view_failed' });
    }
};
