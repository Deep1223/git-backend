const mongoose = require('mongoose');
const { slugifyLabel } = require('../lib/slugifyLabel');

const occasionMasterSchema = new mongoose.Schema({
    occasionname: {
        type: String,
        required: [true, 'Occasion name is required'],
        unique: true,
        trim: true,
    },
    slug: {
        type: String,
        trim: true,
        unique: true,
        sparse: true,
        index: true,
    },
    image: {
        type: String,
        trim: true,
        default: '',
    },
    description: {
        type: String,
        trim: true,
        default: '',
    },
    sortorder: {
        type: Number,
        default: 0,
    },
    status: {
        type: Number,
        default: 1,
    },
    recordinfo: {
        createat: { type: Date, default: Date.now },
        createby: { type: String },
        updateat: { type: Date },
        updateby: { type: String },
    },
});

occasionMasterSchema.pre('save', function () {
    const base = slugifyLabel(this.occasionname);
    if (!this.slug || !String(this.slug).trim()) {
        this.slug = base || 'occasion';
    } else {
        this.slug = slugifyLabel(this.slug) || base || 'occasion';
    }

    if (this.isNew) {
        if (!this.recordinfo) this.recordinfo = {};
        this.recordinfo.updateat = undefined;
        this.recordinfo.updateby = undefined;
    } else if (this.recordinfo) {
        this.recordinfo.updateat = Date.now();
    }
});

module.exports = mongoose.model('OccasionMaster', occasionMasterSchema);
