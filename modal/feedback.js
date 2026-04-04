const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
    },
    type: {
        type: String,
        required: true,
        trim: true,
        maxlength: 80,
    },
    message: {
        type: String,
        trim: true,
        maxlength: 5000,
        default: '',
    },
    includeScreenshot: {
        type: Boolean,
        default: false,
    },
    recordinfo: {
        createat: { type: Date, default: Date.now },
    },
});

module.exports = mongoose.model('Feedback', feedbackSchema);
