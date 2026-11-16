const Check = require('../models/Check');
const Habit = require('../models/Habit');

// CREATE OR UPDATE CHECK
const saveCheck = async(req, res) => {
    try {
        const { habitId, date, status } = req.body;

        const habit = await Habit.findById(habitId);

        if (!habit) {
            return res.status(404).json({
                success: false,
                message: 'Habit not found'
            });
        }

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format. Use YYYY-MM-DD'
            });
        }

        if (!['done', 'skipped'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Status must be done or skipped'
            });
        }

        const check = await Check.findOneAndUpdate({ habitId, date }, { status }, { new: true, upsert: true, runValidators: true });

        res.status(200).json({
            success: true,
            message: 'Check saved successfully',
            check
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// GET ALL CHECKS
const getChecks = async(req, res) => {
    try {
        const checks = await Check.find();

        res.status(200).json({
            success: true,
            count: checks.length,
            checks
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// DELETE A CHECK
const deleteCheck = async(req, res) => {
    try {
        const { habitId, date } = req.params;

        const check = await Check.findOneAndDelete({
            habitId,
            date
        });

        res.status(200).json({
            success: true,
            message: check ?
                'Check deleted successfully' :
                'Check not found'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// MARK ALL HABITS AS DONE
const markAllDone = async(req, res) => {
    try {
        const { habitIds, date } = req.body;

        if (!Array.isArray(habitIds) || habitIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Habit IDs are required'
            });
        }

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({
                success: false,
                message: 'Valid date is required (YYYY-MM-DD)'
            });
        }

        const habits = await Habit.find({
            _id: { $in: habitIds }
        });

        if (habits.length !== new Set(habitIds).size) {
            return res.status(404).json({
                success: false,
                message: 'One or more habits not found'
            });
        }

        const operations = habitIds.map(habitId => ({
            updateOne: {
                filter: { habitId, date },
                update: { $set: { status: 'done' } },
                upsert: true
            }
        }));

        await Check.bulkWrite(operations);

        res.status(200).json({
            success: true,
            message: 'All habits marked as done successfully',
            count: operations.length
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// DELETE ALL CHECKS FOR A DATE
const clearDayChecks = async(req, res) => {
    try {
        const { date } = req.params;

        const result = await Check.deleteMany({ date });

        res.status(200).json({
            success: true,
            message: 'Day checks cleared successfully',
            deletedCount: result.deletedCount
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


module.exports = {
    saveCheck,
    getChecks,
    deleteCheck,
    clearDayChecks,
    markAllDone
};