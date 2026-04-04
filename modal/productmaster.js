const mongoose = require('mongoose');
const { allocateNextProductSeriesCode } = require('../lib/productSeriesAllocator');

const productDetailRowSchema = new mongoose.Schema(
    {
        details: { type: String, trim: true, default: '' },
    },
    { _id: false }
);

const productMasterSchema = new mongoose.Schema({
    productname: {
        type: String,
        required: [true, 'Product name is required'],
        unique: true,
        trim: true
    },
    /** Auto-generated from Series Master (Product Master menu); immutable after create */
    productseries: {
        type: String,
        trim: true,
        unique: true,
        sparse: true,
    },
    price: {
        type: Number,
        required: [true, 'Price is required']
    },
    originalPrice: {
        type: Number,
        required: [true, 'Original price is required']
    },
    /** Storefront promo listing: /promo?offer=bogo */
    buyOneGetOneFree: {
        type: Boolean,
        default: false,
    },
    /** Dashboard: which Orinket homepage sections this product is associated with (marketing / merchandising). */
    storefrontHomeSectionKeys: {
        type: [String],
        default: [],
    },
    categoryid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CategoryMaster',
        required: [true, 'Category is required']
    },
    category: {
        type: String,
        trim: true
    },
    subcategoryid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubCategoryMaster',
    },
    subcategory: {
        type: String,
        trim: true
    },
    images: {
        type: [String],
        default: []
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    /** Units available to sell (dashboard: “Available qty”). Synced with instock on save. */
    availableQty: {
        type: Number,
        default: 1,
        min: 0,
    },
    /** 1 = purchasable flag; kept for filters; derived from availableQty in API when saving. */
    instock: {
        type: Number,
        default: 1
    },
    material: {
        type: String,
        trim: true,
        default: ''
    },
    plating: {
        type: String,
        trim: true,
        default: ''
    },
    dimensions: {
        type: String,
        trim: true,
        default: ''
    },
    weight: {
        type: String,
        trim: true,
        default: ''
    },
    details: {
        type: String,
        trim: true,
        default: ''
    },
    productdetails: {
        type: [productDetailRowSchema],
        default: []
    },
    status: {
        type: Number,
        default: 1
    },
    recordinfo: {
        createat: { type: Date, default: Date.now },
        createby: { type: String },
        updateat: { type: Date },
        updateby: { type: String }
    }
});

productMasterSchema.pre('save', async function () {
    if (this.isNew || this.isModified('availableQty')) {
        let q = Number(this.availableQty);
        if (!Number.isFinite(q)) {
            q = this.isNew ? 1 : 0;
        }
        q = Math.max(0, Math.floor(q));
        this.availableQty = q;
        this.instock = q > 0 ? 1 : 0;
    }

    if (this.isNew) {
        if (!this.recordinfo) this.recordinfo = {};
        this.recordinfo.updateat = undefined;
        this.recordinfo.updateby = undefined;
        if (!this.productseries || !String(this.productseries).trim()) {
            this.productseries = await allocateNextProductSeriesCode();
        }
    } else {
        if (!this.productseries || !String(this.productseries).trim()) {
            this.productseries = await allocateNextProductSeriesCode();
        } else if (this.isModified('productseries')) {
            const existing = await this.constructor.findById(this._id).select('productseries').lean();
            if (existing?.productseries) {
                this.productseries = existing.productseries;
            }
        }
        if (this.recordinfo) {
            this.recordinfo.updateat = Date.now();
        }
    }
});

module.exports = mongoose.model('ProductMaster', productMasterSchema);
