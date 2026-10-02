const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (simple)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Import routes
const medicineRoutes = require('./routes/medicineRoutes');
const salesRoutes = require('./routes/salesRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const customerRoutes = require('./routes/customerRoutes');
const prescriptionRoutes = require('./routes/prescriptionRoutes');
const authRoutes = require('./routes/authRoutes');
const catalogRoutes = require('./routes/catalogRoutes');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/prescriptions', prescriptionRoutes);

// Health check endpoint
// Liveness stays 200, but the response now reports *truthful* database
// readiness instead of claiming success while the database is unreachable.
const { testConnection } = require('./config/database');

app.get('/api/health', async (req, res) => {
  const database = await testConnection();

  res.json({
    success: true,
    message: 'Pharmacy Management API is running',
    timestamp: new Date().toISOString(),
    ready: database.ok === true,
    database: {
      status: database.ok ? 'connected' : 'unreachable',
      driver: database.driver || 'msnodesqlv8',
      authentication: database.auth || null,
      server: database.server || null,
      name: database.database || null,
      login: database.login || null,
      base_tables: database.base_tables ?? null,
      detail: database.ok ? database.message : database.message
    }
  });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  if (err.isOperational) {
    // Expected, explained failures (validation, missing record, database
    // unavailable) — one clear line instead of a stack trace.
    console.error(`${err.statusCode || res.statusCode || 500} ${req.method} ${req.path} - ${err.message}`);
  } else {
    console.error('Server error:', err);
  }

  // Default error
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Something went wrong. Please try again later.';
  }

  res.status(statusCode).json({
    success: false,
    message: message
  });
});

module.exports = app;
