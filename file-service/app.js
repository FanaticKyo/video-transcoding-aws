require('dotenv').config();
const express = require('express');
const fileRoutes = require('./routes/file');
const { connectDB } = require('./config/db');
const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(express.json());

// Connect to DynamoDB
connectDB();

// Routes
app.use('/file', fileRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`File Service running on port ${PORT}`);
});

module.exports = app;
