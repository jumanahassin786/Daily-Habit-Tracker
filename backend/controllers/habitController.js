const mongoose = require('mongoose');
const Habit = require('../models/Habit');
const Check = require('../models/Check');

// CREATE HABIT
const createHabit = async(req, res) => {
    try {
        const { name, icon, color, note, weeklyTarget } = req.body;

        if (
            typeof name !== 'string' ||
            !name.trim() ||
            typeof icon !== 'string' ||
            typeof color !== 'string'
        ) {
            return res.status(400).json({
                success: false,
                message: 'Name, icon and color are required'
            });
        }

        const lastHabit = await Habit.findOne({
            userId: req.user._id
        }).sort({ position: -1 });

        const nextPosition = lastHabit ?
            lastHabit.position + 1 :
            0;

        const habit = await Habit.create({
            userId: req.user._id,
            name: name.trim(),
            icon,
            color,
            note,
            weeklyTarget,
            position: nextPosition
        });

        return res.status(201).json({
            success: true,
            message: 'Habit created successfully',
            habit: {
                id: habit._id,
                name: habit.name,
                icon: habit.icon,
                color: habit.color,
                note: habit.note,
                weeklyTarget: habit.weeklyTarget,
                position: habit.position,
                createdAt: habit.createdAt
            }
        });

    } catch (error) {
        console.error('Create habit error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create habit'
        });
    }
};


// GET ALL USER HABITS
const getHabits = async(req, res) => {
    try {
        const habits = await Habit.find({
            userId: req.user._id
        }).sort({
            position: 1,
            createdAt: -1
        });

        return res.status(200).json({
            success: true,
            count: habits.length,
            habits: habits.map(habit => ({
                id: habit._id,
                name: habit.name,
                icon: habit.icon,
                color: habit.color,
                note: habit.note,
                weeklyTarget: habit.weeklyTarget,
                position: habit.position,
                createdAt: habit.createdAt
            }))
        });

    } catch (error) {
        console.error('Get habits error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve habits'
        });
    }
};


// UPDATE HABIT
const updateHabit = async(req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid habit ID'
            });
        }

        const allowedFields = [
            'name',
            'icon',
            'color',
            'note',
            'weeklyTarget'
        ];

        const updates = {};

        for (const field of allowedFields) {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                updates[field] = req.body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields provided'
            });
        }

        if (
            updates.name !== undefined &&
            (typeof updates.name !== 'string' || !updates.name.trim())
        ) {
            return res.status(400).json({
                success: false,
                message: 'Habit name cannot be empty'
            });
        }

        if (updates.name !== undefined) {
            updates.name = updates.name.trim();
        }

        const habit = await Habit.findOneAndUpdate({
            _id: req.params.id,
            userId: req.user._id
        }, { $set: updates }, {
            new: true,
            runValidators: true
        });

        if (!habit) {
            return res.status(404).json({
                success: false,
                message: 'Habit not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Habit updated successfully',
            habit: {
                id: habit._id,
                name: habit.name,
                icon: habit.icon,
                color: habit.color,
                note: habit.note,
                weeklyTarget: habit.weeklyTarget,
                position: habit.position,
                createdAt: habit.createdAt
            }
        });

    } catch (error) {
        console.error('Update habit error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to update habit'
        });
    }
};


// DELETE HABIT
const deleteHabit = async(req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid habit ID'
            });
        }

        const habit = await Habit.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!habit) {
            return res.status(404).json({
                success: false,
                message: 'Habit not found'
            });
        }

        await Check.deleteMany({
            habitId: habit._id
        });

        return res.status(200).json({
            success: true,
            message: 'Habit and associated checks deleted successfully'
        });

    } catch (error) {
        console.error('Delete habit error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to delete habit'
        });
    }
};


// REORDER USER HABITS
const reorderHabits = async(req, res) => {
    try {
        const { habitIds } = req.body;

        if (!Array.isArray(habitIds)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid habitIds array'
            });
        }

        if (habitIds.some(
                id => !mongoose.Types.ObjectId.isValid(id)
            )) {
            return res.status(400).json({
                success: false,
                message: 'One or more habit IDs are invalid'
            });
        }

        const uniqueIds = [
            ...new Set(habitIds.map(id => id.toString()))
        ];

        if (uniqueIds.length !== habitIds.length) {
            return res.status(400).json({
                success: false,
                message: 'Duplicate habit IDs are not allowed'
            });
        }

        const habits = await Habit.find({
            _id: { $in: uniqueIds },
            userId: req.user._id
        });

        if (habits.length !== uniqueIds.length) {
            return res.status(404).json({
                success: false,
                message: 'One or more habits were not found'
            });
        }

        const totalHabits = await Habit.countDocuments({
            userId: req.user._id
        });

        if (totalHabits !== uniqueIds.length) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all your habit IDs to reorder'
            });
        }

        const operations = uniqueIds.map((id, index) => ({
            updateOne: {
                filter: {
                    _id: id,
                    userId: req.user._id
                },
                update: {
                    $set: { position: index }
                }
            }
        }));

        if (operations.length > 0) {
            await Habit.bulkWrite(operations);
        }

        const updatedHabits = await Habit.find({
            userId: req.user._id
        }).sort({ position: 1 });

        return res.status(200).json({
            success: true,
            message: 'Habits reordered successfully',
            habits: updatedHabits.map(habit => ({
                id: habit._id,
                name: habit.name,
                position: habit.position
            }))
        });

    } catch (error) {
        console.error('Reorder habits error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to reorder habits'
        });
    }
};


module.exports = {
    createHabit,
    getHabits,
    updateHabit,
    deleteHabit,
    reorderHabits
};