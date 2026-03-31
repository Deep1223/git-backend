const EcomProduct = require('../../modal/ecomProduct');
const EcomCategory = require('../../modal/ecomCategory');
const { mapProductPublic } = require('./helpers');

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

        const query = EcomProduct.find(filter).populate('category', 'name slug').sort({ createdAt: -1 }).skip(skip).limit(limit);

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
        const doc = await EcomProduct.findById(req.params.id).populate('category', 'name slug').lean();
        if (!doc || doc.hidden) return res.status(404).json({ success: false, message: 'Product not found' });
        return res.status(200).json({ success: true, data: mapProductPublic(doc) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'product_failed' });
    }
};

exports.createProduct = async (req, res) => {
    try {
        const payload = req.body || {};
        const created = await EcomProduct.create(payload);
        return res.status(201).json({ success: true, data: created });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'product_create_failed' });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const updated = await EcomProduct.findByIdAndUpdate(req.params.id, req.body || {}, { new: true });
        if (!updated) return res.status(404).json({ success: false, message: 'Product not found' });
        return res.status(200).json({ success: true, data: updated });
    } catch (error) {
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
