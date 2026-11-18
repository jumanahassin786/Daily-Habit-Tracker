const express = require('express');
const router = express.Router();

const {
    saveCheck,
    getChecks,
    deleteCheck,
    clearDayChecks,
    markAllDone
} = require('../controllers/checkController');

const protect = require('../middleware/authMiddleware');

// All check routes require authentication
router.use(protect);

// Save or update a check
router.post('/', saveCheck);

// Mark all habits as done
router.post('/bulk', markAllDone);

// Get all checks
router.get('/', getChecks);

// Delete all checks for a date
router.delete('/day/:date', clearDayChecks);

// Delete a specific habit check
router.delete('/:habitId/:date', deleteCheck);

module.exports = router;