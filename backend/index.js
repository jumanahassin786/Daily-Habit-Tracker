const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/db');
const habitRoutes = require('./routes/habitRoutes');
const checkRoutes = require('./routes/checkRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    console.log('Incoming Request:', req.method, req.originalUrl);
    next();
});

// Test API
app.get('/', (req, res) => {
    res.send('Ticked Backend Server is Running!');
});

// Habit API Routes
app.use('/api/auth', authRoutes);
app.use('/api/habits', habitRoutes);
app.use('/api/checks', checkRoutes);
console.log('Registered check routes:', checkRoutes.stack.filter(r => r.route).map(r => ({ path: r.route.path, methods: r.route.methods })));

const PORT = process.env.PORT || 5000;
// Server

const startServer = async() => {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};

startServer();