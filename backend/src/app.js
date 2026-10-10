const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const { assertJwtSecret } = require('./config/jwt');
const { pool } = require('./config/database');
assertJwtSecret();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
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
const prescriptionUploadRoutes = require('./routes/prescriptionUploadRoutes');
const authRoutes = require('./routes/authRoutes');
const { authenticateToken } = require('./middleware/auth');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const billingRoutes = require('./routes/billingRoutes');
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');
const supplierOperationsRoutes = require('./routes/supplierOperationsRoutes');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', authenticateToken, cartRoutes);
app.use('/api/orders', authenticateToken, orderRoutes);
app.use('/api/notifications', authenticateToken, notificationRoutes);
app.use('/api/billing', authenticateToken, billingRoutes);
app.use('/api/purchase-orders', authenticateToken, purchaseOrderRoutes);
app.use('/api/medicines', authenticateToken, medicineRoutes);
app.use('/api/sales', authenticateToken, salesRoutes);
app.use('/api/suppliers', authenticateToken, supplierRoutes);
app.use('/api/purchases', authenticateToken, purchaseRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/prescriptions', authenticateToken, prescriptionRoutes);
app.use('/api/prescription-uploads', authenticateToken, prescriptionUploadRoutes);

// Health check endpoint
app.get('/api/health', async (req, res, next) => {
  try {
    await pool.execute('SELECT 1 AS ready');
  res.json({
    success: true,
    message: 'Pharmacy Management API is running',
    database: 'connected',
    timestamp: new Date().toISOString()
  });
  } catch (error) {
    error.statusCode = 503;
    next(error);
  }
});

// This router owns several /api/* supplier-operation paths. Mount it after
// public and specifically scoped routes so its authentication middleware does
// not intercept customer registration or readiness checks.
app.use('/api', authenticateToken, supplierOperationsRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';

  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Malformed JSON request';
  } else if (err.number === 2601 || err.number === 2627) {
    statusCode = 409;
    message = 'A record with the same unique value already exists';
  } else if (err.number === 547) {
    statusCode = 409;
    message = 'The operation conflicts with related records';
  } else if (statusCode >= 500) {
    message = statusCode === 503 ? 'Service temporarily unavailable' : 'Internal server error';
  }

  if (statusCode >= 500) console.error('Server error:', err);

  res.status(statusCode).json({
    success: false,
    message: message
  });
});

module.exports = app;
