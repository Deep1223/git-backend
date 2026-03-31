const mongoose = require('mongoose');

const seriesMasterSchema = new mongoose.Schema({
    menunameid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MenuMaster',
        required: [true, 'Menu is required']
    },
    menuname: {
        type: String,
        required: [true, 'Menu name is required'],
        trim: true
    },
    /** Legacy / admin display name; some DBs have a unique index on this field */
    seriesname: {
        type: String,
        trim: true,
    },
    seriescode: {
        type: String,
        required: [true, 'Series code is required'],
        unique: true,
        trim: true
    },
    startingnumber: {
        type: Number,
        required: [true, 'Starting number is required'],
        default: 1
    },
    currentnumber: {
        type: Number,
        default: 1
    },
    numberlength: {
        type: Number,
        required: [true, 'Number length is required'],
        default: 4
    },
    separator: {
        type: String,
        default: '-',
        maxlength: 3,
        trim: true
    },
    suffix: {
        type: String,
        default: '',
        maxlength: 20,
        trim: true
    },
    formatpreview: {
        type: String,
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

seriesMasterSchema.pre('save', function() {
    if (this.isNew) {
        if (!this.recordinfo) this.recordinfo = {};
        this.recordinfo.updateat = undefined;
        this.recordinfo.updateby = undefined;
        
        // Ensure currentnumber is set
        if (this.currentnumber === null || this.currentnumber === undefined) {
            this.currentnumber = this.startingnumber || 1;
        }
    } else {
        if (this.recordinfo) {
            this.recordinfo.updateat = Date.now();
        }
    }
});

module.exports = mongoose.model('SeriesMaster', seriesMasterSchema);
