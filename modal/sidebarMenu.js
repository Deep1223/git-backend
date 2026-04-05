const mongoose = require('mongoose');

const sidebarTabSchema = new mongoose.Schema(
    {
        id: { type: String, required: true, trim: true },
        label: { type: String, required: true, trim: true },
        isVisible: { type: Boolean, default: true },
        order: { type: Number, default: 0 },
    },
    { _id: false }
);

const sidebarCategorySchema = new mongoose.Schema(
    {
        id: { type: String, required: true, trim: true },
        name: { type: String, required: true, trim: true },
        href: { type: String, default: '/category/all' },
        imageUrl: { type: String, default: '' },
        isVisible: { type: Boolean, default: true },
        order: { type: Number, default: 0 },
    },
    { _id: false }
);

const sidebarSectionItemSchema = new mongoose.Schema(
    {
        label: { type: String, required: true, trim: true },
        href: { type: String, default: '#' },
    },
    { _id: false }
);

const sidebarSectionSchema = new mongoose.Schema(
    {
        id: { type: String, required: true, trim: true },
        title: { type: String, required: true, trim: true },
        isVisible: { type: Boolean, default: true },
        order: { type: Number, default: 0 },
        items: { type: [sidebarSectionItemSchema], default: [] },
    },
    { _id: false }
);

const sidebarFooterLinkSchema = new mongoose.Schema(
    {
        id: { type: String, required: true, trim: true },
        label: { type: String, required: true, trim: true },
        href: { type: String, default: '#' },
        isVisible: { type: Boolean, default: true },
        order: { type: Number, default: 0 },
    },
    { _id: false }
);

const sidebarMenuSchema = new mongoose.Schema(
    {
        tabs: { type: [sidebarTabSchema], default: [] },
        categories: { type: [sidebarCategorySchema], default: [] },
        sections: { type: [sidebarSectionSchema], default: [] },
        footerLinks: { type: [sidebarFooterLinkSchema], default: [] },
        updatedBy: { type: String, default: '' },
    },
    { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('SidebarMenu', sidebarMenuSchema, 'sidebarMenu');
