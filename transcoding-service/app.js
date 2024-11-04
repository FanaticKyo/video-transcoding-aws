require('dotenv').config();
const express = require('express');
const transcodeRoutes = require('./routes/transcode');
const { connectDB } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(express.json());

// Connect to DynamoDB
connectDB();

// Routes
app.use('/transcode', transcodeRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Transcoding Service running on port ${PORT}`);
});

module.exports = app;
