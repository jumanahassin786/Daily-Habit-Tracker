const mongoose = require('mongoose');

const migrationSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    migratedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Migration', migrationSchema);