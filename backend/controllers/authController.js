const User = require('../models/User');
const Habit = require('../models/Habit');
const Migration = require('../models/Migration');

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (userId) => {
    return jwt.sign({ id: userId },
        process.env.JWT_SECRET, { expiresIn: '7d' }
    );
};

// REGISTER USER
const registerUser = async(req, res) => {
    const { name, email, password } = req.body;

    if (
        typeof name !== 'string' ||
        typeof email !== 'string' ||
        typeof password !== 'string' ||
        !name.trim() ||
        !email.trim() ||
        !password
    ) {
        return res.status(400).json({
            success: false,
            message: 'Please provide valid name, email and password'
        });
    }

    if (password.length < 8) {
        return res.status(400).json({
            success: false,
            message: 'Password must be at least 8 characters'
        });
    }

    if (name.trim().length > 60) {
        return res.status(400).json({
            success: false,
            message: 'Name must not exceed 60 characters'
        });
    }

    const normalizedEmail = email.trim().toLowerCase();

    let session;

    try {
        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Email is already registered'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        let registeredUser;

        // Retry once if simultaneous registrations
        // compete to claim the legacy data.
        for (let attempt = 0; attempt < 2; attempt++) {
            session = await mongoose.startSession();

            try {
                await session.withTransaction(async() => {
                    const users = await User.create(
                        [{
                            name: name.trim(),
                            email: normalizedEmail,
                            password: hashedPassword
                        }], { session }
                    );

                    registeredUser = users[0];

                    // Check whether legacy data has an owner.
                    const migration = await Migration.findById(
                        'legacy-habits-owner'
                    ).session(session);

                    if (!migration) {
                        // Unique migration ID ensures only one
                        // registration can claim legacy data.
                        await Migration.create(
                            [{
                                _id: 'legacy-habits-owner',
                                ownerId: registeredUser._id
                            }], { session }
                        );

                        // Assign existing demo habits to first user.
                        await Habit.updateMany({ userId: { $exists: false } }, {
                            $set: {
                                userId: registeredUser._id
                            }
                        }, { session });
                    }
                });

                // Transaction completed successfully.
                break;

            } catch (error) {
                // Retry if another registration claimed
                // the unique migration marker first.
                if (
                    error.code === 11000 &&
                    attempt === 0
                ) {
                    const duplicateUser = await User.findOne({
                        email: normalizedEmail
                    });

                    if (duplicateUser) {
                        return res.status(409).json({
                            success: false,
                            message: 'Email is already registered'
                        });
                    }

                    continue;
                }

                throw error;

            } finally {
                await session.endSession();
                session = null;
            }
        }

        if (!registeredUser) {
            throw new Error('User registration could not be completed');
        }

        const token = generateToken(registeredUser._id);

        return res.status(201).json({
            success: true,
            message: 'Registration successful',
            token,
            user: {
                id: registeredUser._id,
                name: registeredUser.name,
                email: registeredUser.email
            }
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Email is already registered'
            });
        }

        console.error('Registration error:', error);

        return res.status(500).json({
            success: false,
            message: 'Registration failed'
        });
    }
};


// GET CURRENT LOGGED-IN USER
const getMe = async(req, res) => {
    return res.status(200).json({
        success: true,
        user: {
            id: req.user._id,
            name: req.user.name,
            email: req.user.email
        }
    });
};


// LOGIN USER
const loginUser = async(req, res) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== 'string' ||
            typeof password !== 'string' ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const user = await User.findOne({
            email: normalizedEmail
        }).select('+password');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const isMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const token = generateToken(user._id);

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Login error:', error);

        return res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
};


module.exports = {
    registerUser,
    loginUser,
    getMe
};