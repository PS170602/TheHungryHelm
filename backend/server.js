require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/error');

// Route files
const authRoutes = require('./routes/auth');
const outletRoutes = require('./routes/outlets');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payment');

// Connect to MongoDB
connectDB();

const app = express();

// ── Middleware ─────────────────────────────────────────────
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

// Serve uploaded QR images statically
// e.g. GET http://localhost:5000/uploads/qr/ik.png
const path = require('path');
app.use('/uploads', require('express').static(path.join(__dirname, 'uploads')));

// ── Routes ─────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/outlets', outletRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);

// Health check
app.get('/api/health', (req, res) =>
  res.json({ success: true, message: '⚓ Hungry Helm API is sailing', uptime: process.uptime() })
);

// 404
app.use((req, res) =>
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` })
);

// Global error handler
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`\n⚓  Hungry Helm server running on http://localhost:${PORT}  [${process.env.NODE_ENV || 'development'}]\n`)
);
