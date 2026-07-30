const { BRAND } = require('../config/brand');
const mongoose = require('mongoose');
const dotenv = require('dotenv-vault');
const EcomCategory = require('../modal/ecomCategory');
const EcomProduct = require('../modal/ecomProduct');
const EcomOrder = require('../modal/ecomOrder');
const EcomAnalytics = require('../modal/ecomAnalytics');
const EcomStorefrontSection = require('../modal/ecomStorefrontSection');
const EcomUser = require('../modal/ecomUser');
const { runAllEcomJobsOnce } = require('../jobs/ecom');

dotenv.config();

const CATEGORY_SLUGS = [
    'necklaces',
    'earrings',
    'rings',
    'bracelets',
    'men',
    'gifts',
    'new-arrivals',
];

const IMAGE_POOL = [
    '/images/product-necklace-1.jpg',
    '/images/product-necklace-2.jpg',
    '/images/product-necklace-3.jpg',
    '/images/product-earring-1.jpg',
    '/images/product-earring-2.jpg',
    '/images/product-ring-1.jpg',
    '/images/product-ring-2.jpg',
    '/images/product-bracelet-1.jpg',
];

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
    return arr[rand(0, arr.length - 1)];
}

function buildTags(categorySlug) {
    const common = ['gold', 'dailywear', 'giftable', 'party', 'minimal'];
    const categoryTag = categorySlug === 'new-arrivals' ? 'new' : categorySlug.slice(0, -1);
    const size = rand(2, 4);
    const tags = new Set([categoryTag]);
    while (tags.size < size) tags.add(pick(common));
    return [...tags];
}

function dayKey(date) {
    return date.toISOString().slice(0, 10);
}

async function seed() {
    const mongo = process.env.MONGO_URI || 'mongodb://localhost:27017/common-project';
    await mongoose.connect(mongo);
    console.log('[seed:ecom] connected');

    await Promise.all([
        EcomCategory.deleteMany({}),
        EcomProduct.deleteMany({}),
        EcomOrder.deleteMany({}),
        EcomAnalytics.deleteMany({}),
        EcomStorefrontSection.deleteMany({}),
        EcomUser.deleteMany({ email: BRAND.demoCustomerEmail }),
    ]);

    const categories = await EcomCategory.insertMany(
        CATEGORY_SLUGS.map((slug) => ({
            name: slug.replace('-', ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
            slug,
            status: 1,
        }))
    );
    const bySlug = new Map(categories.map((c) => [c.slug, c]));

    const products = [];
    const productCount = rand(50, 100);
    for (let i = 1; i <= productCount; i += 1) {
        const categorySlug = pick(CATEGORY_SLUGS);
        const category = bySlug.get(categorySlug);
        const price = rand(399, 8999);
        const originalPrice = price + rand(100, 2000);
        products.push({
            name: BRAND.productName(categorySlug, i),
            slug: BRAND.productSlug(categorySlug, i),
            category: category._id,
            price,
            originalPrice,
            images: [pick(IMAGE_POOL), pick(IMAGE_POOL)],
            stock: rand(0, 40),
            tags: buildTags(categorySlug),
            variants: [
                { name: 'size', value: 'S', stock: rand(0, 10) },
                { name: 'size', value: 'M', stock: rand(0, 10) },
                { name: 'size', value: 'L', stock: rand(0, 10) },
            ],
            views: rand(10, 500),
            recentSalesCount: rand(0, 60),
            metadata: { score: rand(1, 100) },
        });
    }
    const createdProducts = await EcomProduct.insertMany(products);

    const demoUser = await EcomUser.create({
        name: 'Demo Customer',
        email: BRAND.demoCustomerEmail,
        password: 'Demo@1234',
        role: 'customer',
    });

    const orders = [];
    for (let i = 0; i < 35; i += 1) {
        const itemCount = rand(1, 3);
        const items = [];
        let totalAmount = 0;
        for (let j = 0; j < itemCount; j += 1) {
            const p = pick(createdProducts);
            const qty = rand(1, 2);
            items.push({
                product: p._id,
                name: p.name,
                image: p.images[0] || '',
                quantity: qty,
                price: p.price,
            });
            totalAmount += qty * p.price;
        }
        const daysAgo = rand(0, 14);
        const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        orders.push({
            user: demoUser._id,
            items,
            totalAmount,
            paymentStatus: Math.random() > 0.15 ? 'paid' : 'pending',
            orderStatus: pick(['processing', 'confirmed', 'shipped', 'delivered']),
            paymentProvider: 'dummy',
            paymentReference: `DUMMY_${Date.now()}_${i}`,
            shippingAddress: {
                name: 'Demo Customer',
                email: demoUser.email,
                phone: '9999999999',
                line1: 'Demo Address Line',
                city: 'Mumbai',
                state: 'Maharashtra',
                pincode: '400001',
            },
            createdAt,
            updatedAt: createdAt,
        });
    }
    await EcomOrder.insertMany(orders);

    const analyticsByDay = new Map();
    for (const order of orders) {
        const key = dayKey(order.createdAt);
        const current = analyticsByDay.get(key) || { revenue: 0, sales: 0, orders: 0, views: rand(100, 900) };
        current.revenue += order.totalAmount;
        current.sales += order.items.reduce((s, item) => s + item.quantity, 0);
        current.orders += 1;
        analyticsByDay.set(key, current);
    }
    await EcomAnalytics.insertMany(
        [...analyticsByDay.entries()].map(([date, row]) => ({
            date,
            views: row.views,
            sales: row.sales,
            revenue: row.revenue,
            orders: row.orders,
        }))
    );

    await EcomStorefrontSection.insertMany([
        { key: 'top-styles', mode: 'auto', products: [] },
        { key: 'trending', mode: 'auto', products: [] },
        { key: 'recommended', mode: 'auto', products: [] },
        { key: 'new-arrivals', mode: 'auto', products: [] },
    ]);

    await runAllEcomJobsOnce();
    console.log(`[seed:ecom] categories=${categories.length} products=${createdProducts.length} orders=${orders.length}`);
    console.log(`[seed:ecom] demo login: ${demoUser.email} / Demo@1234`);
    await mongoose.disconnect();
    console.log('[seed:ecom] done');
}

seed().catch(async (error) => {
    console.error('[seed:ecom] failed:', error);
    await mongoose.disconnect();
    process.exit(1);
});
