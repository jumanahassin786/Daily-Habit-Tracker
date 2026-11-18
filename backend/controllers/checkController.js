const Check = require('../models/Check');
const Habit = require('../models/Habit');

// CREATE OR UPDATE CHECK
const saveCheck = async(req, res) => {
    try {
        const { habitId, date, status } = req.body;

        if (!habitId || !/^[0-9a-fA-F]{24}$/.test(habitId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid habit ID is required'
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

        const habit = await Habit.findOne({
            _id: habitId,
            userId: req.user._id
        });

        if (!habit) {
            return res.status(404).json({
                success: false,
                message: 'Habit not found'
            });
        }

        const check = await Check.findOneAndUpdate({ habitId, date }, { status }, {
            new: true,
            upsert: true,
            runValidators: true
        });

        return res.status(200).json({
            success: true,
            message: 'Check saved successfully',
            check
        });

    } catch (error) {
        console.error('Save check error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to save check'
        });
    }
};


// GET ALL CHECKS FOR LOGGED-IN USER
const getChecks = async(req, res) => {
    try {
        const habits = await Habit.find({
            userId: req.user._id
        }).select('_id');

        const habitIds = habits.map(habit => habit._id);

        const checks = await Check.find({
            habitId: { $in: habitIds }
        });

        return res.status(200).json({
            success: true,
            count: checks.length,
            checks
        });

    } catch (error) {
        console.error('Get checks error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch checks'
        });
    }
};


// DELETE A CHECK
const deleteCheck = async(req, res) => {
    try {
        const { habitId, date } = req.params;

        if (!/^[0-9a-fA-F]{24}$/.test(habitId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid habit ID'
            });
        }

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format'
            });
        }

        const habit = await Habit.findOne({
            _id: habitId,
            userId: req.user._id
        });

        if (!habit) {
            return res.status(404).json({
                success: false,
                message: 'Habit not found'
            });
        }

        const check = await Check.findOneAndDelete({
            habitId,
            date
        });

        return res.status(200).json({
            success: true,
            message: check ?
                'Check deleted successfully' :
                'Check not found'
        });

    } catch (error) {
        console.error('Delete check error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to delete check'
        });
    }
};


// MARK ALL USER HABITS AS DONE
const markAllDone = async(req, res) => {
    try {
        const { habitIds, date } = req.body;

        if (!Array.isArray(habitIds) || habitIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Habit IDs are required'
            });
        }

        if (!habitIds.every(id =>
                typeof id === 'string' &&
                /^[0-9a-fA-F]{24}$/.test(id)
            )) {
            return res.status(400).json({
                success: false,
                message: 'Invalid habit IDs'
            });
        }

        if (new Set(habitIds).size !== habitIds.length) {
            return res.status(400).json({
                success: false,
                message: 'Duplicate habit IDs are not allowed'
            });
        }

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({
                success: false,
                message: 'Valid date is required (YYYY-MM-DD)'
            });
        }

        const habits = await Habit.find({
            _id: { $in: habitIds },
            userId: req.user._id
        });

        if (habits.length !== habitIds.length) {
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

        return res.status(200).json({
            success: true,
            message: 'All habits marked as done successfully',
            count: operations.length
        });

    } catch (error) {
        console.error('Mark all done error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to mark habits as done'
        });
    }
};


// DELETE ALL CHECKS FOR A DATE (CURRENT USER ONLY)
const clearDayChecks = async(req, res) => {
    try {
        const { date } = req.params;

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format'
            });
        }

        const habits = await Habit.find({
            userId: req.user._id
        }).select('_id');

        const habitIds = habits.map(habit => habit._id);

        const result = await Check.deleteMany({
            date,
            habitId: { $in: habitIds }
        });

        return res.status(200).json({
            success: true,
            message: 'Day checks cleared successfully',
            deletedCount: result.deletedCount
        });

    } catch (error) {
        console.error('Clear day checks error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to clear day checks'
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