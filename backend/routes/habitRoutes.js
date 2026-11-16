const express = require('express');
const router = express.Router();

const {
    createHabit,
    getHabits,
    updateHabit,
    deleteHabit
} = require('../controllers/habitController');

// Create a new habit
router.post('/', createHabit);

// Get all habits
router.get('/', getHabits);

// Update an existing habit
router.put('/:id', updateHabit);

// Delete a habit
router.delete('/:id', deleteHabit);

module.exports = router;