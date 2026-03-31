const mongoose = require('mongoose');

const ecomCategorySchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, unique: true },
        slug: { type: String, required: true, trim: true, unique: true, index: true },
        parentCategory: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'EcomCategory',
            default: null,
        },
        status: { type: Number, enum: [0, 1], default: 1 },
    },
    { timestamps: true }
);

module.exports = mongoose.model('EcomCategory', ecomCategorySchema);
