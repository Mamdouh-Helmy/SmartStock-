// api/index.js
const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');

require('dotenv').config();
const connectDB = require('../config/db');

const authRoutes = require('../routes/authRoutes');
const saleRoutes = require('../routes/saleRoutes');
const purchaseRoutes = require('../routes/purchaseRoutes');
const inventoryRoutes = require('../routes/inventoryRoutes');
const clientSupplierRoutes = require('../routes/clientSupplierRoutes');
const reportRoutes = require('../routes/reportRoutes');
const invoiceRoutes = require('../routes/invoiceRoutes');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'https://store-management-467c1.web.app'],
  credentials: true
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/clients-suppliers', clientSupplierRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/invoices', invoiceRoutes);

// Export as Vercel Serverless Function
module.exports = app;
module.exports.handler = serverless(app);
