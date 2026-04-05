/**
 * Seed sidebar menu document in MongoDB.
 *
 * Run:
 *   node scripts/seed-sidebar-menu.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const SidebarMenu = require('../modal/sidebarMenu');

const DEFAULT_MENU = {
    tabs: [
        { id: 'demi-fine-jewellery', label: 'DEMI FINE JEWELLERY', isVisible: true, order: 1 },
        { id: '9kt-fine-gold', label: '9 KT FINE GOLD', isVisible: true, order: 2 },
    ],
    categories: [
        { id: 'necklaces-chains', name: 'Necklaces & Chains', href: '/collections/necklaces-chains', imageUrl: '', isVisible: true, order: 1 },
        { id: 'bracelets', name: 'Bracelets', href: '/collections/bracelets', imageUrl: '', isVisible: true, order: 2 },
        { id: 'earrings', name: 'Earrings', href: '/collections/earrings', imageUrl: '', isVisible: true, order: 3 },
        { id: 'rings', name: 'Rings', href: '/collections/rings', imageUrl: '', isVisible: true, order: 4 },
        { id: 'mens-chains', name: "Men's Chains", href: '/collections/mens-chains', imageUrl: '', isVisible: true, order: 5 },
        { id: 'jewellery-sets', name: 'Jewellery Sets', href: '/collections/jewellery-sets', imageUrl: '', isVisible: true, order: 6 },
        { id: 'anklets', name: 'Anklets', href: '/collections/anklets', imageUrl: '', isVisible: true, order: 7 },
        { id: 'mangalsutras', name: 'Mangalsutras', href: '/collections/mangalsutras', imageUrl: '', isVisible: true, order: 8 },
    ],
    sections: [
        { id: 'new-arrivals', title: 'New Arrivals', isVisible: true, order: 1, items: [] },
        { id: 'best-seller', title: 'Best Seller', isVisible: true, order: 2, items: [] },
        { id: 'fine-silver', title: 'Fine Silver', isVisible: true, order: 3, items: [] },
        { id: 'shop-by-occasion', title: 'Shop by Occasion', isVisible: true, order: 4, items: [] },
        { id: 'shop-by-collection', title: 'Shop by Collection', isVisible: true, order: 5, items: [] },
        { id: 'shop-by-gender', title: 'Shop by Gender', isVisible: true, order: 6, items: [] },
        { id: 'gifting', title: 'Gifting', isVisible: true, order: 7, items: [] },
    ],
    footerLinks: [
        { id: 'return-exchange', label: 'Return & Exchange', href: '/returns', isVisible: true, order: 1 },
        { id: 'about-us', label: 'About Us', href: '/about', isVisible: true, order: 2 },
        { id: 'support', label: 'Support', href: '/contact', isVisible: true, order: 3 },
    ],
    updatedBy: 'script:seed-sidebar-menu',
};

async function main() {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/common-project';
    await mongoose.connect(uri);

    let doc = await SidebarMenu.findOne().sort({ createdAt: 1 });
    if (!doc) {
        doc = await SidebarMenu.create(DEFAULT_MENU);
        console.log('Created sidebar menu with default sections/categories.');
    } else {
        doc.tabs = DEFAULT_MENU.tabs;
        doc.categories = DEFAULT_MENU.categories;
        doc.sections = DEFAULT_MENU.sections;
        doc.footerLinks = DEFAULT_MENU.footerLinks;
        doc.updatedBy = DEFAULT_MENU.updatedBy;
        await doc.save();
        console.log('Updated existing sidebar menu with default seed data.');
    }

    await mongoose.disconnect();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
