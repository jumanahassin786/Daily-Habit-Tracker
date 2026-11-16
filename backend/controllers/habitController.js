const Habit = require('../models/Habit');

// CREATE HABIT
const createHabit = async(req, res) => {
    try {
        const { name, icon, color, note, weeklyTarget } = req.body;

        const habit = await Habit.create({
            name,
            icon,
            color,
            note,
            weeklyTarget
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
        const habits = await Habit.find().sort({ createdAt: -1 });

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

        res.status(200).json({
            success: true,
            message: 'Habit deleted successfully'
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
    deleteHabit
};