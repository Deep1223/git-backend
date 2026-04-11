const mongoose = require('mongoose');

/** Atomic counters for human-readable order numbers (e.g. ORN000001). */
const ecomSequenceSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, unique: true },
        seq: { type: Number, default: 0 },
    },
    { timestamps: false }
);

module.exports = mongoose.model('EcomSequence', ecomSequenceSchema);
