import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import 'dotenv/config';
import mongoose from 'mongoose';

import userRoutes from './routes/users.js';
import paymentRoutes from './routes/payments.js';
import adminRoutes from './routes/admin.js';

const app = express();
const mongoURI = process.env.MONGODB_URI;
const port = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// Middleware
app.use(express.json());

const corsOptions = {
  origin: 'http://localhost:3000',
  credentials: true,
};
app.use(cors(corsOptions));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP' }
});
app.use('/api/', generalLimiter);

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Payments Portal API is running' });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working!' });
});

// MongoDB Connection
if (!mongoURI) {
  console.warn('MONGODB_URI is not set in environment variables.');
} else {
  mongoose
    .connect(mongoURI)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.log('Error connecting to MongoDB:', err));
}

// Start server
app.listen(port, () => {
  console.log(`Payments Portal API running on http://localhost:${port}`);
  console.log(`Available endpoints:`);
  console.log(`- Health: http://localhost:${port}/api/health`);
  console.log(`- Test: http://localhost:${port}/api/test`);
  console.log(`- Users test: http://localhost:${port}/api/users/test`);
  console.log(`- Users debug: http://localhost:${port}/api/users/debug`);
  console.log(`- Payments: http://localhost:${port}/api/payments`);
  console.log(`- Admin: http://localhost:${port}/api/admin`);
});