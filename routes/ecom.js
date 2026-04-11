const express = require('express');
const { optionalEcomAuth } = require('../middleware/ecomAuth');
const auth = require('../api/ecom/auth');
const categories = require('../api/ecom/categories');
const products = require('../api/ecom/products');
const cart = require('../api/ecom/cart');
const orders = require('../api/ecom/ordersV2');
const storefront = require('../api/ecom/storefront');
const recommendations = require('../api/ecom/recommendations');
const analytics = require('../api/ecom/analytics');

const router = express.Router();

router.use(optionalEcomAuth);

// Auth
router.post('/auth/register', auth.register);
router.post('/auth/login', auth.login);
router.post('/auth/logout', auth.logout);
router.get('/auth/me', auth.me);

// Categories
router.get('/categories', categories.listCategories);
router.post('/categories', categories.createCategory);
router.put('/categories/:id', categories.updateCategory);
router.delete('/categories/:id', categories.deleteCategory);

// Products
router.get('/products', products.listProducts);
router.get('/products/:id', products.getProduct);
router.post('/products', products.createProduct);
router.put('/products/:id', products.updateProduct);
router.delete('/products/:id', products.deleteProduct);
router.post('/products/:id/view', products.trackProductView);

// Cart
router.get('/cart', cart.getCart);
router.post('/cart/add', cart.addToCart);
router.post('/cart/update', cart.updateCartItem);
router.delete('/cart/item/:productId', cart.removeCartItem);

// Orders / Payment
router.post('/orders', orders.createOrder);
router.get('/orders', orders.listOrders);
router.get('/orders/track', orders.trackOrder);
router.get('/orders/:id', orders.getOrderById);
router.patch('/orders/:id/return-request', orders.requestReturn);
router.post('/payments/create-order', orders.dummyCreatePaymentOrder);
router.post('/payments/verify', orders.verifyPayment);
router.post('/payments/webhook/razorpay', orders.razorpayWebhook);

// Storefront
router.get('/storefront/home', storefront.getHomeSections);
router.get('/storefront/top-styles', storefront.getTopStyles);
router.get('/storefront/trending', storefront.getTrending);
router.get('/storefront/recommended', storefront.getRecommended);
router.put('/storefront/sections/:key', storefront.upsertSectionControl);

// Recommendations
router.get('/recommendations/frequently-bought-together', recommendations.frequentlyBoughtTogether);
router.get('/recommendations/similar-products', recommendations.similarProducts);
router.get('/recommendations/complete-the-look', recommendations.completeTheLook);
router.get('/recommendations/cart-upsell', recommendations.cartUpsell);

// Analytics
router.get('/analytics/summary', analytics.getDashboardSummary);

module.exports = router;
