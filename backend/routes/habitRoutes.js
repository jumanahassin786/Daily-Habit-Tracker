const express = require('express');
const router = express.Router();

const {
    createHabit,
    getHabits,
    updateHabit,
    deleteHabit,
    reorderHabits
} = require('../controllers/habitController');

// Create a new habit
router.post('/', createHabit);

// Reorder habits
router.post('/reorder', reorderHabits);

// Get all habits
router.get('/', getHabits);

// Update an existing habit
router.put('/:id', updateHabit);

// Delete an existing habit
router.delete('/:id', deleteHabit);

module.exports = router;