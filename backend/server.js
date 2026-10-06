require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger for debugging & audit trail
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// API Routes
app.use('/api', apiRoutes);

// Root health check
app.get('/', (req, res) => {
  res.json({
    message: 'Manufacturing Production and Quality Management API is running',
    version: '1.0.0',
    documentation: '/api/system/status'
  });
});

// Connect Database (with automatic fallback) and start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🏭 Manufacturing & Quality Management Backend Online`);
    console.log(`🚀 Port: http://localhost:${PORT}`);
    console.log(`📊 Quality Analytics: http://localhost:${PORT}/api/analytics/quality`);
    console.log(`🛠️ System Status: http://localhost:${PORT}/api/system/status`);
    console.log(`====================================================`);
  });
});
