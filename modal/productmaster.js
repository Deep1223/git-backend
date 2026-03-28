const mongoose = require('mongoose');

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
    price: {
        type: Number,
        required: [true, 'Price is required']
    },
    originalPrice: {
        type: Number,
        required: [true, 'Original price is required']
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

productMasterSchema.pre('save', function () {
    if (this.isNew) {
        if (!this.recordinfo) this.recordinfo = {};
        this.recordinfo.updateat = undefined;
        this.recordinfo.updateby = undefined;
    } else if (this.recordinfo) {
        this.recordinfo.updateat = Date.now();
    }
});

module.exports = mongoose.model('ProductMaster', productMasterSchema);
