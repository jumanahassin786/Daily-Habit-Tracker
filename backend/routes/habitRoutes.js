const express = require('express');
const router = express.Router();

const {
    createHabit,
    getHabits,
    updateHabit,
    deleteHabit,
    reorderHabits
} = require('../controllers/habitController');

const protect = require('../middleware/authMiddleware');

// All habit routes require authentication
router.use(protect);

// Create a new habit
router.post('/', createHabit);

// Reorder habits
router.post('/reorder', reorderHabits);

// Get all user habits
router.get('/', getHabits);

// Update an existing habit
router.put('/:id', updateHabit);

// Delete an existing habit
router.delete('/:id', deleteHabit);

module.exports = router;