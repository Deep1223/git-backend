const EcomCategory = require('../../modal/ecomCategory');

exports.listCategories = async (_req, res) => {
    try {
        const items = await EcomCategory.find({ status: 1 }).sort({ name: 1 }).lean();
        return res.status(200).json({ success: true, data: items });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'categories_failed' });
    }
};

exports.createCategory = async (req, res) => {
    try {
        const { name, slug, parentCategory } = req.body || {};
        if (!name || !slug) {
            return res.status(400).json({ success: false, message: 'name and slug are required' });
        }
        const created = await EcomCategory.create({ name, slug, parentCategory: parentCategory || null });
        return res.status(201).json({ success: true, data: created });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'category_create_failed' });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const updated = await EcomCategory.findByIdAndUpdate(req.params.id, req.body || {}, { new: true });
        if (!updated) return res.status(404).json({ success: false, message: 'Category not found' });
        return res.status(200).json({ success: true, data: updated });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'category_update_failed' });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const deleted = await EcomCategory.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, message: 'Category not found' });
        return res.status(200).json({ success: true, message: 'Category deleted' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'category_delete_failed' });
    }
};
