const storefrontHomeMasterAliases = require('../config/storefrontHomeMasterAliases');
const {
    getStorefrontMasterList,
    getStorefrontMasterById,
    createStorefrontMaster,
    updateStorefrontMaster,
    deleteStorefrontMaster,
} = require('../api/storefrontHomeMasters');

/**
 * Registers /api/{alias} routes for all 14 homepage storefront masters.
 * @param {import('express').Router} router
 * @param {{ protect: Function, audit: Function }} middleware
 */
function registerStorefrontHomeMasters(router, { protect, audit }) {
    storefrontHomeMasterAliases.forEach((alias) => {
        router.route(`/${alias}`).post(protect, getStorefrontMasterList(alias)).get(protect, getStorefrontMasterList(alias));
        router.route(`/${alias}/create`).post(protect, audit('CREATE', `Storefront:${alias}`), createStorefrontMaster(alias));
        router.route(`/${alias}/update`).post(protect, audit('UPDATE', `Storefront:${alias}`), updateStorefrontMaster(alias));
        router.route(`/${alias}/delete`).post(protect, audit('DELETE', `Storefront:${alias}`), deleteStorefrontMaster(alias));
        router.route(`/${alias}/:id`).get(protect, getStorefrontMasterById(alias));
    });
}

module.exports = registerStorefrontHomeMasters;
