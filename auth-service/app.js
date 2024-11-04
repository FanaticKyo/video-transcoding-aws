require('dotenv').config();
const express = require('express');

const authRoutes = require('./routes/auth');
const { connectDB } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// Connect to DynamoDB
connectDB();

// Routes
app.use('/auth', authRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Auth Service running on port ${PORT}`);
});

module.exports = app;
