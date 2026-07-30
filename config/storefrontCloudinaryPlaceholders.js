/**
 * Stable Cloudinary **demo** delivery URLs (`res.cloudinary.com/demo`, image `sample`).
 * Different `w`/`h`/`c`/`q` transforms = distinct URLs, all valid without your own uploads.
 *
 * Hero banners use **curated stock** (Unsplash, jewellery) — not `sample`, which is always the same flower.
 * Production: put assets on your Cloudinary and swap URLs, e.g.
 *   `https://res.cloudinary.com/<CLOUD_NAME>/image/upload/v.../<brand>/hero-1.jpg`
 */
function demo(transform) {
    return `https://res.cloudinary.com/demo/image/upload/${transform}/sample`;
}

/** Unsplash — jewellery / luxury (Unsplash License). Replace with your Cloudinary uploads when ready. */
const heroJewelry = (photoId) =>
    `https://images.unsplash.com/${photoId}?auto=format&w=1920&h=640&fit=crop&q=85`;

module.exports = {
    /** Hero carousel — rings / hands */
    hero1: heroJewelry('photo-1515562141207-7a88fb7ce338'),
    /** Hero carousel — gold pieces flatlay */
    hero2: heroJewelry('photo-1611652022419-a9419f74343d'),
    /** Hero carousel — necklace / editorial */
    hero3: heroJewelry('photo-1599643478518-a784e5dc4c8f'),
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
