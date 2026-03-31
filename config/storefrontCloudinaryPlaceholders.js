/**
 * Stable Cloudinary **demo** delivery URLs (`res.cloudinary.com/demo`, image `sample`).
 * Different `w`/`h`/`c`/`q` transforms = distinct URLs, all valid without your own uploads.
 *
 * Swap to your folder: `https://res.cloudinary.com/<CLOUDINARY_CLOUD_NAME>/image/upload/v.../orinket/...`
 */
function demo(transform) {
    return `https://res.cloudinary.com/demo/image/upload/${transform}/sample`;
}

module.exports = {
    /** Hero carousel (Storefront homepage master / general settings) */
    hero1: demo('w_1920,h_640,c_fill,q_auto,f_auto'),
    hero2: demo('w_1920,h_640,c_fill,q_88'),
    hero3: demo('w_1920,h_640,c_fill,q_92'),
    wideSale: demo('w_1600,h_520,c_fill,q_auto,f_auto'),
    brandWide: demo('w_1600,h_700,c_fill,q_auto'),
    deserve: demo('w_1200,h_800,c_fill,q_auto'),
    bag: demo('w_800,h_800,c_fill,q_auto'),
    shoes: demo('w_700,h_700,c_fill,q_auto'),
    kitchen: demo('w_800,h_800,c_fill,q_85'),
    car: demo('w_800,h_800,c_fill,q_90'),
    portrait: demo('w_800,h_1000,c_fill,q_auto'),
    blog1: demo('w_900,h_600,c_fill,q_auto'),
    blog2: demo('w_900,h_580,c_fill,q_auto'),
    blog3: demo('w_900,h_620,c_fill,q_auto'),
    store1: demo('w_900,h_600,c_fill,q_auto'),
    store2: demo('w_880,h_600,c_fill,q_auto'),
    sample: demo('w_800,h_800,c_fill,q_auto,f_auto'),
};
