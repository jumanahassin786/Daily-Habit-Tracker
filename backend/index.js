const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/db');
const habitRoutes = require('./routes/habitRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Test API
app.get('/', (req, res) => {
    res.send('Ticked Backend Server is Running!');
});

// Habit API Routes
app.use('/api/habits', habitRoutes);

// Server
const PORT = process.env.PORT || 5000;

const startServer = async() => {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};

startServer();