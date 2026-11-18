const mongoose = require('mongoose');

const habitSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },

    icon: {
        type: String,
        required: true
    },

    color: {
        type: String,
        required: true
    },

    note: {
        type: String,
        default: ''
    },

    weeklyTarget: {
        type: Number,
        min: 1,
        max: 7
    },

    position: {
        type: Number,
        default: 0
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Habit = mongoose.model('Habit', habitSchema);

module.exports = Habit;