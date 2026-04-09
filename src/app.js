const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security headers
app.use(helmet());

// Allow cross-origin requests (configure origins via CORS_ORIGIN env var)
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
}));

// Request logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Parse JSON bodies
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/auth',  require('./routes/auth'));
// app.use('/api/trips', require('./routes/trips'));

// Global error handler — must be last
app.use(errorHandler);

module.exports = app;
