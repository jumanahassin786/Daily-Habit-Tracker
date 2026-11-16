const mongoose = require('mongoose');

const checkSchema = new mongoose.Schema({
    habitId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Habit',
        required: true
    },

    date: {
        type: String,
        required: true
    },

    status: {
        type: String,
        enum: ['done', 'skipped'],
        required: true
    }
});

// Prevent duplicate entries for the same habit and date
checkSchema.index({ habitId: 1, date: 1 }, { unique: true });

const Check = mongoose.model('Check', checkSchema);

module.exports = Check;