const EcomAnalytics = require('../../modal/ecomAnalytics');
const EcomOrder = require('../../modal/ecomOrder');
const EcomProduct = require('../../modal/ecomProduct');

exports.getDashboardSummary = async (_req, res) => {
    try {
        const [ordersAgg, topProducts, lowStockCount, analyticsRecent] = await Promise.all([
            EcomOrder.aggregate([
                { $match: { paymentStatus: { $in: ['pending', 'paid'] } } },
                {
                    $group: {
                        _id: null,
                        totalSales: { $sum: '$totalAmount' },
                        totalOrders: { $sum: 1 },
                    },
                },
            ]),
            EcomProduct.find({ hidden: { $ne: true } })
                .sort({ recentSalesCount: -1, updatedAt: -1 })
                .limit(5)
                .select('name images stock recentSalesCount')
                .lean(),
            EcomProduct.countDocuments({ stock: { $lt: Number(process.env.LOW_STOCK_THRESHOLD || 5) }, hidden: { $ne: true } }),
            EcomAnalytics.find().sort({ date: -1 }).limit(7).lean(),
        ]);

        const totals = ordersAgg[0] || { totalSales: 0, totalOrders: 0 };
        return res.status(200).json({
            success: true,
            data: {
                totalSales: totals.totalSales,
                totalOrders: totals.totalOrders,
                topProducts: topProducts.map((p) => ({
                    id: p._id,
                    name: p.name,
                    image: p.images?.[0] || '',
                    stock: p.stock,
                    soldUnits: p.recentSalesCount || 0,
                })),
                lowStockCount,
                analyticsLast7Days: analyticsRecent.reverse(),
                tooltip: 'Based on last 7 days sales',
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'dashboard_summary_failed' });
    }
};
