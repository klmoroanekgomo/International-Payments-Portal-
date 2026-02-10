import express from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import Payment from '../models/Payment.js';

const router = express.Router();

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key_123', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// RegEx patterns for payment validation
const patterns = {
  name: /^[a-zA-Z\s]{2,100}$/,
  iban: /^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/,
  swift: /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/,
  amount: /^\d+(\.\d{1,2})?$/,
  currency: /^[A-Z]{3}$/
};

// Payment validation middleware
const paymentValidation = [
  body('recipient_name')
    .matches(patterns.name).withMessage('Recipient name must be 2-100 alphabetic characters'),
  body('recipient_account')
    .matches(patterns.iban).withMessage('Invalid IBAN format'),
  body('recipient_bank_swift')
    .matches(patterns.swift).withMessage('Invalid SWIFT/BIC code'),
  body('amount')
    .matches(patterns.amount).withMessage('Invalid amount format')
    .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('currency')
    .matches(patterns.currency).withMessage('Invalid currency code'),
  body('description')
    .optional()
    .isLength({ max: 500 }).withMessage('Description too long')
    .escape()
];

// Get all payments for logged-in user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .select('-__v');

    res.json({ 
      message: 'Payments retrieved successfully',
      payments 
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Create new payment
router.post('/', authenticateToken, paymentValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      recipient_name,
      recipient_account,
      recipient_bank_swift,
      amount,
      currency,
      description
    } = req.body;

    const payment = new Payment({
      userId: req.user.id,
      recipientName: recipient_name,
      recipientAccount: recipient_account,
      recipientBankSwift: recipient_bank_swift,
      amount: parseFloat(amount),
      currency,
      description: description || '',
      status: 'pending'
    });

    await payment.save();

    res.status(201).json({
      message: 'Payment created successfully',
      paymentId: payment._id,
      payment: {
        id: payment._id,
        recipientName: payment.recipientName,
        recipientAccount: payment.recipientAccount,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        createdAt: payment.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// Test route (no auth required)
router.get('/test', (req, res) => {
  res.json({ message: 'Payments route is working!' });
});

export default router;