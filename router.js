const express = require('express');
const router = express.Router();
const ecomRouter = require('./routes/ecom');

// Controllers
const {getAllCategories, getCategoryById, createCategory, updateCategory, deleteCategory} = require('./api/categorymaster');
const {getAllCountries, getCountryById, createCountry, updateCountry, deleteCountry} = require('./api/countrymaster');
const { getAllSeries, getSeriesById, createSeries, updateSeries, deleteSeries} = require('./api/seriesmaster');
const { generateUsercode } = require('./api/generateusercode_simple');
const {getAllCities, getCityById, createCity, updateCity, deleteCity} = require('./api/citymaster');
const {getAllStates, getStateById, createState, updateState, deleteState} = require('./api/statemaster');
const {getAllIcons, getIconById, createIcon, updateIcon, deleteIcon} = require('./api/iconmaster');
const { getAllModules, getModuleById, createModule, updateModule, deleteModule} = require('./api/modulemaster');
const { getAllMenuAssignments, getMenuAssignmentById, createMenuAssignment, updateMenuAssignment, deleteMenuAssignment } = require('./api/menuassignmaster');
const {
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    previewNextProductSeries,
} = require('./api/productmaster');
const { getAllSubCategories, getSubCategoryById, createSubCategory, updateSubCategory, deleteSubCategory } = require('./api/subcategorymaster');
const {
    getAllOccasions,
    getOccasionById,
    createOccasion,
    updateOccasion,
    deleteOccasion,
} = require('./api/occasionmaster');
const {
    getAllGeneralSettings,
    getGeneralSettingById,
    createGeneralSetting,
    updateGeneralSetting,
    deleteGeneralSetting,
} = require('./api/generalsetting');
const {
    getAllStorefrontReviews,
    getStorefrontReviewById,
    createStorefrontReview,
    updateStorefrontReview,
    deleteStorefrontReview,
    postPublicProductReviews,
    submitPublicProductReview,
} = require('./api/storefrontreviewsmaster');
const {
    getAllSpinLogs,
    getSpinLogById,
    createSpinLog,
    updateSpinLog,
    deleteSpinLog,
} = require('./api/spinlogmaster');
const registerStorefrontHomeMasters = require('./routes/storefrontHomeMasters');
const { getAllModules: getAllMenus, getModuleById: getMenuById, createModule: createMenu, updateModule: updateMenu, deleteModule: deleteMenu} = require('./api/menumaster');
const {
    signup,
    login,
    logout,
    googleLogin,
    forgotPassword,
    resetPassword,
    getMe,
    setup2FA,
    verify2FA,
    toggle2FA,
    updateProfile,
    changePassword,
    getLoginSessions,
    removeLoginSession,
    getMyActivity,
    getAllUserLogins,
} = require('./api/auth');
const { submitFeedback } = require('./api/feedback');
const { protect } = require('./middleware/auth');

const audit = require('./middleware/audit');

const {getAllUsers, getUserById, createUser, updateUser, deleteUser} = require('./api/usermaster');
const { getConfig } = require('./api/config');
const { listNotifications, markNotificationRead, markAllRead } = require('./api/adminNotifications');
const { getStoreInventorySettings, updateStoreInventorySettings } = require('./api/storeInventorySettings');
const { checkSpin, spin } = require('./api/spin');
const { getSettings, updateSettings } = require('./api/settings');
const {
    postPublicSidebarMenu,
    getSidebarMenuMaster,
    createSidebarMenuCategory,
    updateSidebarMenuCategory,
    deleteSidebarMenuCategory,
    reorderSidebarMenuSections,
    toggleSidebarMenuVisibility,
} = require('./api/sidebarMenu');
const { validatePromo } = require('./api/promoValidate');
const adminLowStockCatalog = require('./api/ecom/adminLowStockCatalog');
const adminOrders = require('./api/ecom/adminOrders');
const adminShipping = require('./api/ecom/adminShipping');
const adminReturnRefund = require('./api/ecom/adminReturnRefund');
const { cleanupTempUploads, uploadImage, uploadMiddleware } = require('./api/upload');
const {
    postPublicCategories,
    postPublicSubcategories,
    postPublicProducts,
    postPublicTopStyles,
    postPublicStoreSettings,
    postPublicCmsContact,
    postPublicCmsFaq,
    postPublicCmsShipping,
    postPublicCmsReturns,
    postPublicOccasions,
} = require('./publicapis');

const {
    getAllCmsContact,
    getCmsContactById,
    createCmsContact,
    updateCmsContact,
    deleteCmsContact,
} = require('./api/cmsContact');
const {
    getAllCmsFaq,
    getCmsFaqById,
    createCmsFaq,
    updateCmsFaq,
    deleteCmsFaq,
} = require('./api/cmsFaq');
const {
    getAllCmsShipping,
    getCmsShippingById,
    createCmsShipping,
    updateCmsShipping,
    deleteCmsShipping,
} = require('./api/cmsShipping');
const {
    getAllCmsReturns,
    getCmsReturnsById,
    createCmsReturns,
    updateCmsReturns,
    deleteCmsReturns,
} = require('./api/cmsReturns');

// Auth Routes
router.route('/auth/signup').post(signup);
router.route('/auth/login').post(login);
router.route('/auth/logout').get(logout);
router.route('/auth/google').post(googleLogin);
router.route('/auth/forgotpassword').post(forgotPassword);
router.route('/auth/resetpassword').post(resetPassword);
router.route('/auth/me').get(protect, getMe);
router.route('/auth/profile').put(protect, audit('UPDATE', 'User'), updateProfile);
router.route('/auth/password').put(protect, audit('UPDATE', 'User'), changePassword);
router.route('/auth/sessions').get(protect, getLoginSessions);
router.route('/auth/sessions/:id').delete(protect, audit('UPDATE', 'User'), removeLoginSession);
router.route('/auth/activity').get(protect, getMyActivity);
router.route('/auth/feedback').post(protect, submitFeedback);
router.route('/auth/2fa/setup').post(setup2FA); // Removed protect for login flow support
router.route('/auth/2fa/verify').post(verify2FA); // Removed protect for login flow support
router.route('/auth/2fa').put(protect, audit('2FA_TOGGLE', 'User'), toggle2FA);
router.route('/auth/admin/user-logins').get(protect, getAllUserLogins);

// Generate Usercode Routes
router.route('/generateusercode').get(generateUsercode).post(generateUsercode);

// User Master Routes
router.route('/usermaster').get(protect, getAllUsers).post(protect, audit('CREATE', 'User'), getAllUsers);
router.route('/usermaster/create').post(protect, audit('CREATE', 'User'), createUser);
router.route('/usermaster/update').post(protect, audit('UPDATE', 'User'), updateUser);
router.route('/usermaster/delete').post(protect, audit('DELETE', 'User'), deleteUser);
router.route('/usermaster/:id').get(protect, getUserById);

// Upload Routes
router.post('/upload', protect, uploadMiddleware, uploadImage);
router.post('/upload/cleanup-temp', protect, cleanupTempUploads);

// Category Master Routes (base path: /category)
router.route('/category/create').post(protect, audit('CREATE', 'Category'), createCategory);
router.route('/category/update').post(protect, audit('UPDATE', 'Category'), updateCategory);
router.route('/category/delete').post(protect, audit('DELETE', 'Category'), deleteCategory);
router.route('/category/:id').get(protect, getCategoryById);
router.route('/category').post(protect, getAllCategories);


// Country Master Routes
router.route('/countrymaster').post(protect, getAllCountries);
router.route('/countrymaster/create').post(protect, audit('CREATE', 'Country'), createCountry);
router.route('/countrymaster/update').post(protect, audit('UPDATE', 'Country'), updateCountry);
router.route('/countrymaster/delete').post(protect, audit('DELETE', 'Country'), deleteCountry);
router.route('/countrymaster/:id').get(protect, getCountryById);

// Series Master Routes
router.route('/seriesmaster').post(protect, getAllSeries);
router.route('/seriesmaster/create').post(protect, audit('CREATE', 'Series'), createSeries);
router.route('/seriesmaster/update').post(protect, audit('UPDATE', 'Series'), updateSeries);
router.route('/seriesmaster/delete').post(protect, audit('DELETE', 'Series'), deleteSeries);
router.route('/seriesmaster/:id').get(protect, getSeriesById);

// State Master Routes
router.route('/statemaster').post(protect, getAllStates);
router.route('/statemaster/create').post(protect, audit('CREATE', 'State'), createState);
router.route('/statemaster/update').post(protect, audit('UPDATE', 'State'), updateState);
router.route('/statemaster/delete').post(protect, audit('DELETE', 'State'), deleteState);
router.route('/statemaster/:id').get(protect, getStateById);

// City Master Routes
router.route('/citymaster').post(protect, getAllCities);
router.route('/citymaster/create').post(protect, audit('CREATE', 'City'), createCity);
router.route('/citymaster/update').post(protect, audit('UPDATE', 'City'), updateCity);
router.route('/citymaster/delete').post(protect, audit('DELETE', 'City'), deleteCity);
router.route('/citymaster/:id').get(protect, getCityById);


// Icon Master Routes
router.route('/iconmaster').post(protect, getAllIcons).get(protect, getAllIcons);
router.route('/iconmaster/create').post(protect, audit('CREATE', 'Icon'), createIcon);
router.route('/iconmaster/update').post(protect, audit('UPDATE', 'Icon'), updateIcon);
router.route('/iconmaster/delete').post(protect, audit('DELETE', 'Icon'), deleteIcon);
router.route('/iconmaster/:id').get(protect, getIconById);

// Module Master Routes
router.route('/modulemaster').post(protect, getAllModules).get(protect, getAllModules);
router.route('/modulemaster/create').post(protect, audit('CREATE', 'Module'), createModule);
router.route('/modulemaster/update').post(protect, audit('UPDATE', 'Module'), updateModule);
router.route('/modulemaster/delete').post(protect, audit('DELETE', 'Module'), deleteModule);
router.route('/modulemaster/:id').get(protect, getModuleById);

// Menu Master Routes
router.route('/menumaster').post(protect, getAllMenus).get(protect, getAllMenus);
router.route('/menumaster/create').post(protect, audit('CREATE', 'Menu'), createMenu);
router.route('/menumaster/update').post(protect, audit('UPDATE', 'Menu'), updateMenu);
router.route('/menumaster/delete').post(protect, audit('DELETE', 'Menu'), deleteMenu);
router.route('/menumaster/:id').get(protect, getMenuById);

// Menu Assign Master Routes
router.route('/menuassignmaster').post(protect, getAllMenuAssignments).get(protect, getAllMenuAssignments);
router.route('/menuassignmaster/create').post(protect, audit('CREATE', 'MenuAssign'), createMenuAssignment);
router.route('/menuassignmaster/update').post(protect, audit('UPDATE', 'MenuAssign'), updateMenuAssignment);
router.route('/menuassignmaster/delete').post(protect, audit('DELETE', 'MenuAssign'), deleteMenuAssignment);
router.route('/menuassignmaster/:id').get(protect, getMenuAssignmentById);

// Product Master Routes
router.route('/productmaster').post(protect, getAllProducts).get(protect, getAllProducts);
router.route('/productmaster/preview-next-series').get(protect, previewNextProductSeries);
router.route('/productmaster/create').post(protect, audit('CREATE', 'Product'), createProduct);
router.route('/productmaster/update').post(protect, audit('UPDATE', 'Product'), updateProduct);
router.route('/productmaster/delete').post(protect, audit('DELETE', 'Product'), deleteProduct);
router.route('/productmaster/:id').get(protect, getProductById);

// Occasion Master Routes
router.route('/occasionmaster').post(protect, getAllOccasions).get(protect, getAllOccasions);
router.route('/occasionmaster/create').post(protect, audit('CREATE', 'Occasion'), createOccasion);
router.route('/occasionmaster/update').post(protect, audit('UPDATE', 'Occasion'), updateOccasion);
router.route('/occasionmaster/delete').post(protect, audit('DELETE', 'Occasion'), deleteOccasion);
router.route('/occasionmaster/:id').get(protect, getOccasionById);

// Sub Category Master Routes
router.route('/subcategorymaster').post(protect, getAllSubCategories).get(protect, getAllSubCategories);
router.route('/subcategorymaster/create').post(protect, audit('CREATE', 'SubCategory'), createSubCategory);
router.route('/subcategorymaster/update').post(protect, audit('UPDATE', 'SubCategory'), updateSubCategory);
router.route('/subcategorymaster/delete').post(protect, audit('DELETE', 'SubCategory'), deleteSubCategory);
router.route('/subcategorymaster/:id').get(protect, getSubCategoryById);

// General Settings (store configuration)
router.route('/generalsetting').post(protect, getAllGeneralSettings).get(protect, getAllGeneralSettings);
router.route('/generalsetting/create').post(protect, audit('CREATE', 'GeneralSetting'), createGeneralSetting);
router.route('/generalsetting/update').post(protect, audit('UPDATE', 'GeneralSetting'), updateGeneralSetting);
router.route('/generalsetting/delete').post(protect, audit('DELETE', 'GeneralSetting'), deleteGeneralSetting);
router.route('/generalsetting/:id').get(protect, getGeneralSettingById);

// Storefront Reviews Master (read-only in dashboard; data comes from storefront submissions)
router.route('/storefrontreviewsmaster').post(protect, getAllStorefrontReviews).get(protect, getAllStorefrontReviews);
router.route('/storefrontreviewsmaster/create').post(protect, audit('CREATE', 'StorefrontReview'), createStorefrontReview);
router.route('/storefrontreviewsmaster/update').post(protect, audit('UPDATE', 'StorefrontReview'), updateStorefrontReview);
router.route('/storefrontreviewsmaster/delete').post(protect, audit('DELETE', 'StorefrontReview'), deleteStorefrontReview);
router.route('/storefrontreviewsmaster/:id').get(protect, getStorefrontReviewById);

// Spin log (read-only dashboard — data from storefront spin-to-win)
router.route('/spinlogmaster').post(protect, getAllSpinLogs).get(protect, getAllSpinLogs);
router.route('/spinlogmaster/create').post(protect, audit('CREATE', 'SpinLog'), createSpinLog);
router.route('/spinlogmaster/update').post(protect, audit('UPDATE', 'SpinLog'), updateSpinLog);
router.route('/spinlogmaster/delete').post(protect, audit('DELETE', 'SpinLog'), deleteSpinLog);
router.route('/spinlogmaster/:id').get(protect, getSpinLogById);

// Storefront homepage section masters (14 aliases → GeneralSetting.storefrontContentJson)
registerStorefrontHomeMasters(router, { protect, audit });

// Admin notifications (dashboard header — cookie/Bearer auth)
router.get('/notifications', protect, listNotifications);
router.patch('/notifications/:id/read', protect, markNotificationRead);
router.post('/notifications/mark-all-read', protect, markAllRead);

// Store inventory — low stock threshold (e-com catalog + jobs + dashboard KPI)
router.get('/store-inventory-settings', protect, getStoreInventorySettings);
router.put('/store-inventory-settings', protect, audit('UPDATE', 'StoreInventorySettings'), updateStoreInventorySettings);

// E-com catalog — low-stock list + stock edits (dashboard auth; must be registered before /ecom router)
router.get('/ecom/admin/low-stock-products', protect, adminLowStockCatalog.listLowStockCatalogProducts);
router.patch(
    '/ecom/admin/low-stock-products/:id',
    protect,
    audit('UPDATE', 'EcomProduct'),
    adminLowStockCatalog.patchLowStockCatalogProductStock
);

// Storefront orders — list + status (dashboard auth; must be registered before /ecom router)
router.get('/ecom/admin/orders', protect, adminOrders.listAdminOrders);
router.get('/ecom/admin/orders/export', protect, adminOrders.exportOrdersCsv);
router.get('/ecom/admin/orders/reports/export', protect, adminOrders.exportOrdersReport);
router.get('/ecom/admin/orders/reports/summary', protect, adminOrders.getOrderReportSummary);
router.get('/ecom/admin/orders/detail/:id', protect, adminOrders.getAdminOrderDetail);
router.get('/ecom/admin/shipping-center', protect, adminShipping.listAdminShippingCases);
router.get('/ecom/admin/return-refund-center', protect, adminReturnRefund.listAdminReturnRefundCases);
router.post(
    '/ecom/admin/orders/bulk-status',
    protect,
    audit('UPDATE', 'EcomOrder'),
    adminOrders.bulkAdminOrderStatus
);
router.post('/ecom/admin/orders/print-labels', protect, adminOrders.printOrderLabelsPdf);
router.patch(
    '/ecom/admin/orders/:id',
    protect,
    audit('UPDATE', 'EcomOrder'),
    adminOrders.patchAdminOrderStatus
);
router.get('/ecom/admin/orders/:id/shipping', protect, adminShipping.getAdminShippingDetail);
router.put('/ecom/admin/orders/:id/shipping', protect, audit('UPDATE', 'EcomShipment'), adminShipping.upsertAdminShippingDetail);
router.post('/ecom/admin/orders/:id/shipping/generate-awb', protect, audit('UPDATE', 'EcomShipment'), adminShipping.generateAdminShippingAwb);
router.post('/ecom/admin/orders/:id/shipping/book-pickup', protect, audit('UPDATE', 'EcomShipment'), adminShipping.bookAdminShippingPickup);
router.put('/ecom/admin/orders/:id/shipping/pickup', protect, audit('UPDATE', 'EcomShipment'), adminShipping.updateAdminShippingPickup);
router.put('/ecom/admin/orders/:id/shipping/exception', protect, audit('UPDATE', 'EcomShipment'), adminShipping.updateAdminShippingException);
router.put('/ecom/admin/orders/:id/shipping/state', protect, audit('UPDATE', 'EcomShipment'), adminShipping.markAdminShipmentState);
router.get('/ecom/admin/orders/:id/return-refund', protect, adminReturnRefund.getAdminReturnRefundDetail);
router.post('/ecom/admin/orders/:id/return-refund/review', protect, audit('UPDATE', 'EcomReturnRefund'), adminReturnRefund.approveOrRejectAdminReturn);
router.put('/ecom/admin/orders/:id/return-refund', protect, audit('UPDATE', 'EcomReturnRefund'), adminReturnRefund.updateAdminReturnRefund);

// Config Route
router.get('/config', getConfig); // Public access for app config
router.post('/config', getConfig); // Support POST for email/password authentication

// Storefront public listings (read-only, no auth) — POST body = dashboard-style listing
router.post('/public/categories', postPublicCategories);
router.post('/public/subcategories', postPublicSubcategories);
router.post('/public/products', postPublicProducts);
router.post('/public/occasions', postPublicOccasions);
router.post('/public/top-styles', postPublicTopStyles);
router.post('/public/store-settings', postPublicStoreSettings);
router.post('/public/sidebar-menu', postPublicSidebarMenu);
router.post('/public/product-reviews', postPublicProductReviews);
router.post('/public/product-reviews/submit', submitPublicProductReview);
router.post('/public/cms-contact', postPublicCmsContact);
router.post('/public/cms-faq', postPublicCmsFaq);
router.post('/public/cms-shipping', postPublicCmsShipping);
router.post('/public/cms-returns', postPublicCmsReturns);

// Storefront promo (spin coupons + static codes) — no auth
router.post('/promo/validate', validatePromo);

// Spin to win (backend-controlled popup visibility + spin result)
router.post('/check-spin', checkSpin);
router.post('/spin', spin);

// Popup frequency settings (GET = public; PUT = admin dashboard)
router.get('/settings', getSettings);
router.put('/settings', protect, audit('UPDATE', 'Settings'), updateSettings);

// Sidebar menu master (dashboard auth)
router.post('/sidebarmenu', protect, getSidebarMenuMaster);
router.post('/sidebarmenu/category/create', protect, audit('CREATE', 'SidebarMenuCategory'), createSidebarMenuCategory);
router.post('/sidebarmenu/category/update', protect, audit('UPDATE', 'SidebarMenuCategory'), updateSidebarMenuCategory);
router.post('/sidebarmenu/category/delete', protect, audit('DELETE', 'SidebarMenuCategory'), deleteSidebarMenuCategory);
router.post('/sidebarmenu/sections/reorder', protect, audit('UPDATE', 'SidebarMenuSection'), reorderSidebarMenuSections);
router.post('/sidebarmenu/visibility/toggle', protect, audit('UPDATE', 'SidebarMenuVisibility'), toggleSidebarMenuVisibility);

// CMS support pages (dashboard)
router.route('/cmscontact').post(protect, getAllCmsContact).get(protect, getAllCmsContact);
router.route('/cmscontact/create').post(protect, audit('CREATE', 'CmsContact'), createCmsContact);
router.route('/cmscontact/update').post(protect, audit('UPDATE', 'CmsContact'), updateCmsContact);
router.route('/cmscontact/delete').post(protect, audit('DELETE', 'CmsContact'), deleteCmsContact);
router.route('/cmscontact/:id').get(protect, getCmsContactById);

router.route('/cmsfaq').post(protect, getAllCmsFaq).get(protect, getAllCmsFaq);
router.route('/cmsfaq/create').post(protect, audit('CREATE', 'CmsFaq'), createCmsFaq);
router.route('/cmsfaq/update').post(protect, audit('UPDATE', 'CmsFaq'), updateCmsFaq);
router.route('/cmsfaq/delete').post(protect, audit('DELETE', 'CmsFaq'), deleteCmsFaq);
router.route('/cmsfaq/:id').get(protect, getCmsFaqById);

router.route('/cmsshipping').post(protect, getAllCmsShipping).get(protect, getAllCmsShipping);
router.route('/cmsshipping/create').post(protect, audit('CREATE', 'CmsShipping'), createCmsShipping);
router.route('/cmsshipping/update').post(protect, audit('UPDATE', 'CmsShipping'), updateCmsShipping);
router.route('/cmsshipping/delete').post(protect, audit('DELETE', 'CmsShipping'), deleteCmsShipping);
router.route('/cmsshipping/:id').get(protect, getCmsShippingById);

router.route('/cmsreturns').post(protect, getAllCmsReturns).get(protect, getAllCmsReturns);
router.route('/cmsreturns/create').post(protect, audit('CREATE', 'CmsReturns'), createCmsReturns);
router.route('/cmsreturns/update').post(protect, audit('UPDATE', 'CmsReturns'), updateCmsReturns);
router.route('/cmsreturns/delete').post(protect, audit('DELETE', 'CmsReturns'), deleteCmsReturns);
router.route('/cmsreturns/:id').get(protect, getCmsReturnsById);

// User-specific data routes
const userRoutes = require('./api/users/userData');
router.use('/users', userRoutes);

// New e-commerce REST APIs (auth/products/cart/orders/storefront/recommendations)
router.use('/ecom', ecomRouter);

module.exports = router;
