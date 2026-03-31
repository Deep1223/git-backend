/* eslint-disable no-console */
const BASE = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5000';
const sessionId = `smoke_${Date.now()}`;

async function request(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'x-session-id': sessionId,
            ...(options.headers || {}),
        },
    });
    const json = await res.json().catch(() => ({}));
    return { res, json };
}

async function run() {
    console.log('[smoke] base=', BASE);

    const health = await request('/health', { headers: { Accept: 'application/json' } });
    if (!health.res.ok) throw new Error('Health check failed');

    const categories = await request('/api/ecom/categories');
    if (!categories.res.ok || !Array.isArray(categories.json.data)) throw new Error('Categories failed');
    console.log('[smoke] categories=', categories.json.data.length);

    const products = await request('/api/ecom/products?page=1&limit=5');
    if (!products.res.ok || !Array.isArray(products.json.data) || products.json.data.length === 0) {
        throw new Error('Products failed');
    }
    const firstProduct = products.json.data[0];
    console.log('[smoke] first product=', firstProduct.id);

    const add = await request('/api/ecom/cart/add', {
        method: 'POST',
        body: JSON.stringify({ productId: firstProduct.id, quantity: 1 }),
    });
    if (!add.res.ok || add.json.success === false) throw new Error('Cart add failed');

    const upsell = await request('/api/ecom/recommendations/cart-upsell?cartTotal=500');
    if (!upsell.res.ok || upsell.json.success === false) throw new Error('Upsell API failed');

    const order = await request('/api/ecom/orders', {
        method: 'POST',
        body: JSON.stringify({
            paymentMethod: 'card',
            shippingAddress: {
                name: 'Smoke User',
                email: 'smoke@test.com',
                phone: '9999999999',
                line1: 'Smoke Address',
                city: 'Mumbai',
                state: 'MH',
                pincode: '400001',
            },
        }),
    });
    if (!order.res.ok || !order.json?.data?._id) throw new Error('Order create failed');
    console.log('[smoke] order=', order.json.data._id);

    const verify = await request('/api/ecom/payments/verify', {
        method: 'POST',
        body: JSON.stringify({
            orderId: order.json.data._id,
            status: 'success',
            paymentReference: `SMOKE_${Date.now()}`,
        }),
    });
    if (!verify.res.ok || verify.json.success === false) throw new Error('Payment verify failed');

    const analytics = await request('/api/ecom/analytics/summary');
    if (!analytics.res.ok || analytics.json.success === false) throw new Error('Analytics failed');
    console.log('[smoke] analytics ok');

    console.log('[smoke] PASSED');
}

run().catch((error) => {
    console.error('[smoke] FAILED:', error.message);
    process.exit(1);
});
