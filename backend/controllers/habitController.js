const mongoose = require('mongoose');
const Habit = require('../models/Habit');
const Check = require('../models/Check');

// CREATE HABIT
const createHabit = async(req, res) => {
    try {
        const { name, icon, color, note, weeklyTarget } = req.body;

        const lastHabit = await Habit.findOne().sort({ position: -1 });

        const nextPosition = lastHabit ? lastHabit.position + 1 : 0;

        const habit = await Habit.create({
            name,
            icon,
            color,
            note,
            weeklyTarget,
            position: nextPosition
        });

        res.status(201).json({
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
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// GET ALL HABITS
const getHabits = async(req, res) => {
    try {
        const habits = await Habit.find().sort({
            position: 1,
            createdAt: -1
        });

        res.status(200).json({
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
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// UPDATE HABIT
const updateHabit = async(req, res) => {
    try {
        const habit = await Habit.findByIdAndUpdate(
            req.params.id,
            req.body, {
                new: true,
                runValidators: true
            }
        );

        if (!habit) {
            return res.status(404).json({
                success: false,
                message: 'Habit not found'
            });
        }

        res.status(200).json({
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
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// DELETE HABIT
const deleteHabit = async(req, res) => {
    try {
        const habit = await Habit.findByIdAndDelete(req.params.id);

        if (!habit) {
            return res.status(404).json({
                success: false,
                message: 'Habit not found'
            });
        }

        // Delete all checks associated with this habit
        await Check.deleteMany({ habitId: habit._id });

        res.status(200).json({
            success: true,
            message: 'Habit and associated checks deleted successfully'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// REORDER HABITS
const reorderHabits = async(req, res) => {
    try {
        const { habitIds } = req.body;

        if (!Array.isArray(habitIds) || habitIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid habitIds array'
            });
        }

        if (habitIds.some(id => !mongoose.Types.ObjectId.isValid(id))) {
            return res.status(400).json({
                success: false,
                message: 'One or more habit IDs are invalid'
            });
        }

        const uniqueIds = [...new Set(habitIds.map(id => id.toString()))];

        if (uniqueIds.length !== habitIds.length) {
            return res.status(400).json({
                success: false,
                message: 'Duplicate habit IDs are not allowed'
            });
        }

        const habits = await Habit.find({
            _id: { $in: uniqueIds }
        });

        if (habits.length !== uniqueIds.length) {
            return res.status(404).json({
                success: false,
                message: 'One or more habits were not found'
            });
        }

        const allHabits = await Habit.countDocuments();

        if (allHabits !== uniqueIds.length) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all habit IDs to reorder'
            });
        }

        const operations = uniqueIds.map((id, index) => ({
            updateOne: {
                filter: { _id: id },
                update: { $set: { position: index } }
            }
        }));

        await Habit.bulkWrite(operations);

        const updatedHabits = await Habit.find().sort({
            position: 1
        });

        res.status(200).json({
            success: true,
            message: 'Habits reordered successfully',
            habits: updatedHabits.map(habit => ({
                id: habit._id,
                name: habit.name,
                position: habit.position
            }))
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
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