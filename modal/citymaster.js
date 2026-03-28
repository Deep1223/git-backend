const mongoose = require('mongoose');

const cityMasterSchema = new mongoose.Schema({
    countryid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CountryMaster',
        required: [true, 'Country is required']
    },
    country: {
        type: String,
        required: false,
        trim: true
    },
    stateid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StateMaster',
        required: [true, 'State is required']
    },
    state: {
        type: String,
        required: false,
        trim: true
    },
    cityname: {
        type: String,
        required: [true, 'City name is required'],
        trim: true
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

cityMasterSchema.pre('save', function() {
    if (this.isNew) {
        if (!this.recordinfo) this.recordinfo = {};
        this.recordinfo.updateat = undefined;
        this.recordinfo.updateby = undefined;
    } else {
        if (this.recordinfo) {
            this.recordinfo.updateat = Date.now();
        }
    }
});

module.exports = mongoose.model('CityMaster', cityMasterSchema);