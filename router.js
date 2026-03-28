const express = require('express');
const router = express.Router();

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
const { getAllProducts, getProductById, createProduct, updateProduct, deleteProduct } = require('./api/productmaster');
const { getAllSubCategories, getSubCategoryById, createSubCategory, updateSubCategory, deleteSubCategory } = require('./api/subcategorymaster');
const { getAllModules: getAllMenus, getModuleById: getMenuById, createModule: createMenu, updateModule: updateMenu, deleteModule: deleteMenu} = require('./api/menumaster');
const {signup, login, logout, googleLogin, forgotPassword, resetPassword, getMe, setup2FA, verify2FA, toggle2FA} = require('./api/auth');
const { protect } = require('./middleware/auth');

const audit = require('./middleware/audit');

const {getAllUsers, getUserById, createUser, updateUser, deleteUser} = require('./api/usermaster');
const { getConfig } = require('./api/config');
const { uploadImage, uploadMiddleware } = require('./api/upload');

// Auth Routes
router.route('/auth/signup').post(signup);
router.route('/auth/login').post(login);
router.route('/auth/logout').get(logout);
router.route('/auth/google').post(googleLogin);
router.route('/auth/forgotpassword').post(forgotPassword);
router.route('/auth/resetpassword').post(resetPassword);
router.route('/auth/me').get(getMe);
router.route('/auth/2fa/setup').post(setup2FA); // Removed protect for login flow support
router.route('/auth/2fa/verify').post(verify2FA); // Removed protect for login flow support
router.route('/auth/2fa').put(protect, toggle2FA);

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
router.route('/productmaster/create').post(protect, audit('CREATE', 'Product'), createProduct);
router.route('/productmaster/update').post(protect, audit('UPDATE', 'Product'), updateProduct);
router.route('/productmaster/delete').post(protect, audit('DELETE', 'Product'), deleteProduct);
router.route('/productmaster/:id').get(protect, getProductById);

// Sub Category Master Routes
router.route('/subcategorymaster').post(protect, getAllSubCategories).get(protect, getAllSubCategories);
router.route('/subcategorymaster/create').post(protect, audit('CREATE', 'SubCategory'), createSubCategory);
router.route('/subcategorymaster/update').post(protect, audit('UPDATE', 'SubCategory'), updateSubCategory);
router.route('/subcategorymaster/delete').post(protect, audit('DELETE', 'SubCategory'), deleteSubCategory);
router.route('/subcategorymaster/:id').get(protect, getSubCategoryById);

// Config Route
router.get('/config', getConfig); // Public access for app config
router.post('/config', getConfig); // Support POST for email/password authentication

module.exports = router;
