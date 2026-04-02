/**
 * Public HTTP handlers for the storefront (no auth).
 * Listing endpoints mirror dashboard POST bodies: paginationinfo + searchtext.
 */
const { postPublicCategories } = require('./catalogCategories');
const { postPublicSubcategories } = require('./catalogSubcategories');
const { postPublicProducts } = require('./catalogProducts');
const { postPublicTopStyles } = require('./topStyles');
const { postPublicStoreSettings } = require('./storeSettings');
const {
    postPublicCmsContact,
    postPublicCmsFaq,
    postPublicCmsShipping,
    postPublicCmsReturns,
} = require('./cmsSupport');

module.exports = {
    postPublicCategories,
    postPublicSubcategories,
    postPublicProducts,
    postPublicTopStyles,
    postPublicStoreSettings,
    postPublicCmsContact,
    postPublicCmsFaq,
    postPublicCmsShipping,
    postPublicCmsReturns,
};
