const EcomProduct = require('../../modal/ecomProduct');
const ProductMaster = require('../../modal/productmaster');
const { getLowStockThreshold } = require('../../modal/storeInventorySettings');
const { mirrorAvailableQtyFromEcomProduct } = require('../../lib/catalogProductMasterSync');

/**
 * Dashboard-only: active storefront SKUs with stock strictly below the configured threshold.
 */
exports.listLowStockCatalogProducts = async (_req, res) => {
    try {
        const threshold = await getLowStockThreshold();
        const filter = { hidden: { $ne: true }, stock: { $lt: threshold } };
        const products = await EcomProduct.find(filter)
            .populate('category', 'name slug')
            .sort({ stock: 1, name: 1 })
            .lean();

        const names = [...new Set(products.map((p) => p.name).filter((n) => n && String(n).trim()))];
        let pmByName = new Map();
        if (names.length) {
            const pmRows = await ProductMaster.find({ productname: { $in: names } })
                .select('productname productseries')
                .lean();
            pmByName = new Map(pmRows.map((row) => [row.productname, row]));
        }

        const masterIds = [
            ...new Set(
                products
                    .map((p) => p.productMasterId)
                    .filter((id) => id != null)
                    .map((id) => String(id))
            ),
        ];
        let pmById = new Map();
        if (masterIds.length) {
            const pmRows = await ProductMaster.find({
                _id: { $in: masterIds },
            })
                .select('productname productseries')
                .lean();
            pmById = new Map(pmRows.map((row) => [String(row._id), row]));
        }

        const data = products
            .filter((p) => p.category)
            .map((p) => {
                const pmLinked =
                    p.productMasterId != null ? pmById.get(String(p.productMasterId)) : null;
                const pm = pmLinked || (p.name ? pmByName.get(p.name) : null);
                const displayName =
                    (pm?.productname && String(pm.productname).trim()) || p.name;
                return {
                    id: String(p._id),
                    name: displayName,
                    slug: p.slug,
                    productSeries: pm?.productseries ? String(pm.productseries) : '',
                    stock: p.stock,
                    categoryName: p.category?.name || '',
                    categorySlug: p.category?.slug || '',
                    isLowStock: !!p.isLowStock,
                };
            });

        return res.status(200).json({
            success: true,
            threshold,
            count: data.length,
            data,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'low_stock_list_failed' });
    }
};

/**
 * Update storefront catalog stock for one product; refreshes isLowStock from current threshold.
 */
exports.patchLowStockCatalogProductStock = async (req, res) => {
    try {
        const threshold = await getLowStockThreshold();
        const { id } = req.params;
        const stock = Math.max(0, Math.floor(Number(req.body?.stock)));

        if (!Number.isFinite(stock) || req.body?.stock === undefined || req.body?.stock === null) {
            return res.status(400).json({ success: false, message: 'Valid stock (0 or greater) is required' });
        }

        const updated = await EcomProduct.findOneAndUpdate(
            { _id: id, hidden: { $ne: true } },
            {
                $set: {
                    stock,
                    isLowStock: stock < threshold,
                },
            },
            { new: true }
        )
            .populate('category', 'name slug')
            .populate('productMasterId', 'productname productseries')
            .lean();

        if (!updated) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        await mirrorAvailableQtyFromEcomProduct(id);

        res.locals.auditDetails = `ecomProduct ${id} stock=${stock}`;

        const pm = updated.productMasterId && typeof updated.productMasterId === 'object' ? updated.productMasterId : null;
        const displayName = (pm?.productname && String(pm.productname).trim()) || updated.name;

        return res.status(200).json({
            success: true,
            data: {
                id: String(updated._id),
                name: displayName,
                slug: updated.slug,
                stock: updated.stock,
                categoryName: updated.category?.name || '',
                isLowStock: !!updated.isLowStock,
                threshold,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'stock_update_failed' });
    }
};
