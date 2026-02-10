import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';

const router = express.Router();

// Rate limiter for failed login attempts only
const failedLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many failed login attempts. Please try again later.' },
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    return `${req.body.username}_${req.ip}`;
  }
});

// RegEx patterns for validation
const usernamePattern = /^[a-zA-Z0-9_]{3,30}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const idNumberPattern = /^[A-Za-z0-9]{5,20}$/;
const accountNumberPattern = /^[0-9]{8,12}$/;

// Debug route to check users
router.get('/debug', async (req, res) => {
  try {
    const users = await User.find({});
    const usersWithInfo = users.map(user => ({
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      accountNumber: user.accountNumber,
      hasPassword: !!user.password
    }));
    res.json({ 
      message: 'Debug endpoint working',
      totalUsers: users.length,
      users: usersWithInfo 
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'Users route is working!' });
});

// Customer Registration
router.post('/register', [
  body('username')
    .matches(usernamePattern).withMessage('Username must be 3-30 alphanumeric characters')
    .notEmpty().withMessage('Username is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .notEmpty().withMessage('Password is required'),
  body('email')
    .matches(emailPattern).withMessage('Please enter a valid email')
    .notEmpty().withMessage('Email is required'),
  body('fullName')
    .isLength({ min: 2, max: 100 }).withMessage('Full name must be 2-100 characters')
    .notEmpty().withMessage('Full name is required'),
  body('idNumber')
    .matches(idNumberPattern).withMessage('ID number must be 5-20 alphanumeric characters')
    .notEmpty().withMessage('ID number is required'),
  body('accountNumber')
    .matches(accountNumberPattern).withMessage('Account number must be 8-12 digits')
    .notEmpty().withMessage('Account number is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password, email, fullName, idNumber, accountNumber } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { username },
        { email },
        { accountNumber }
      ]
    });

    if (existingUser) {
      return res.status(400).json({ 
        error: 'User with this username, email or account number already exists' 
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = new User({
      username,
      password: hashedPassword,
      email,
      fullName,
      idNumber,
      accountNumber,
      role: 'customer' // Always set as customer for registration
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id, 
        username: user.username,
        role: user.role 
      },
      process.env.JWT_SECRET || 'fallback_secret_key_123',
      { expiresIn: '24h' }
    );

    res.status(201).json({ 
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Enhanced Login Route with Role Validation
router.post('/login', [
  body('username')
    .matches(usernamePattern).withMessage('Username must be 3-30 alphanumeric characters')
    .notEmpty().withMessage('Username is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .notEmpty().withMessage('Password is required'),
  body('loginType')
    .optional()
    .isIn(['customer', 'admin']).withMessage('Invalid login type')
], failedLoginLimiter, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password, loginType } = req.body;
  console.log('Login attempt for username:', username, 'Login type:', loginType);

  try {
    const user = await User.findOne({ username });
    console.log('User found:', user ? 'Yes' : 'No');
    
    if (!user) {
      console.log('No user found with username:', username);
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    console.log('Comparing password...');
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password match:', isMatch);

    if (!isMatch) {
      console.log('Password does not match for user:', username);
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    // BACKEND ROLE VALIDATION - Prevent cross-portal login
    if (loginType === 'customer' && (user.role === 'admin' || user.role === 'employee')) {
      console.log('Admin/employee trying to login as customer:', username);
      return res.status(403).json({ 
        error: 'Access denied. Please use the Admin Login portal.' 
      });
    }

    if ((loginType === 'admin' || loginType === 'employee') && user.role === 'customer') {
      console.log('Customer trying to login as admin:', username);
      return res.status(403).json({ 
        error: 'Access denied. This portal is for bank staff only.' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id, 
        username: user.username,
        role: user.role 
      },
      process.env.JWT_SECRET || 'fallback_secret_key_123',
      { expiresIn: '24h' }
    );

    console.log('Login successful for user:', username, 'Role:', user.role);
    res.status(200).json({ 
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Create admin/employee user (for internal use only - protected route)
router.post('/create-staff', [
  body('username')
    .matches(usernamePattern).withMessage('Username must be 3-30 alphanumeric characters')
    .notEmpty().withMessage('Username is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .notEmpty().withMessage('Password is required'),
  body('email')
    .matches(emailPattern).withMessage('Please enter a valid email')
    .notEmpty().withMessage('Email is required'),
  body('fullName')
    .isLength({ min: 2, max: 100 }).withMessage('Full name must be 2-100 characters')
    .notEmpty().withMessage('Full name is required'),
  body('idNumber')
    .matches(idNumberPattern).withMessage('ID number must be 5-20 alphanumeric characters')
    .notEmpty().withMessage('ID number is required'),
  body('accountNumber')
    .matches(accountNumberPattern).withMessage('Account number must be 8-12 digits')
    .notEmpty().withMessage('Account number is required'),
  body('role')
    .isIn(['admin', 'employee']).withMessage('Role must be admin or employee')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password, email, fullName, idNumber, accountNumber, role } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { username },
        { email },
        { accountNumber }
      ]
    });

    if (existingUser) {
      return res.status(400).json({ 
        error: 'User with this username, email or account number already exists' 
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create staff user
    const user = new User({
      username,
      password: hashedPassword,
      email,
      fullName,
      idNumber,
      accountNumber,
      role
    });

    await user.save();

    res.status(201).json({ 
      message: 'Staff user created successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error creating staff user:', error);
    res.status(500).json({ error: 'Server error during staff creation' });
  }
});

// Get user profile (protected)
router.get('/profile', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key_123');
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        accountNumber: user.accountNumber,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;