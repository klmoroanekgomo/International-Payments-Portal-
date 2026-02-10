import express from 'express';
import jwt from 'jsonwebtoken';
import Payment from '../models/Payment.js';
import User from '../models/User.js';

const router = express.Router();

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key_123', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    // Check if user is admin/employee
    if (user.role !== 'admin' && user.role !== 'employee') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    req.user = user;
    next();
  });
};

// Get all pending payments (for admin dashboard)
router.get('/payments/pending', authenticateAdmin, async (req, res) => {
  try {
    const payments = await Payment.find({ status: 'pending' })
      .populate('userId', 'username email fullName accountNumber')
      .sort({ createdAt: -1 });

    res.json({
      message: 'Pending payments retrieved successfully',
      payments
    });
  } catch (error) {
    console.error('Error fetching pending payments:', error);
    res.status(500).json({ error: 'Failed to fetch pending payments' });
  }
});

// Get all payments with filters (for admin)
router.get('/payments', authenticateAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const filter = status ? { status } : {};
    
    const payments = await Payment.find(filter)
      .populate('userId', 'username email fullName accountNumber')
      .populate('verifiedBy', 'username')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(filter);

    res.json({
      message: 'Payments retrieved successfully',
      payments,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Approve payment
router.put('/payments/:id/approve', authenticateAdmin, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.status !== 'pending') {
      return res.status(400).json({ error: 'Payment already processed' });
    }

    payment.status = 'approved';
    payment.verifiedBy = req.user.id;
    payment.verifiedAt = new Date();
    
    await payment.save();

    res.json({
      message: 'Payment approved successfully',
      payment
    });
  } catch (error) {
    console.error('Error approving payment:', error);
    res.status(500).json({ error: 'Failed to approve payment' });
  }
});

// Reject payment
router.put('/payments/:id/reject', authenticateAdmin, async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    
    const payment = await Payment.findById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.status !== 'pending') {
      return res.status(400).json({ error: 'Payment already processed' });
    }

    payment.status = 'rejected';
    payment.verifiedBy = req.user.id;
    payment.verifiedAt = new Date();
    payment.rejectionReason = rejectionReason;
    
    await payment.save();

    res.json({
      message: 'Payment rejected successfully',
      payment
    });
  } catch (error) {
    console.error('Error rejecting payment:', error);
    res.status(500).json({ error: 'Failed to reject payment' });
  }
});

// Submit to SWIFT (final approval)
router.put('/payments/:id/submit-swift', authenticateAdmin, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.status !== 'approved') {
      return res.status(400).json({ error: 'Payment must be approved first' });
    }

    payment.status = 'submitted_to_swift';
    payment.submittedToSwiftAt = new Date();
    
    await payment.save();

    res.json({
      message: 'Payment submitted to SWIFT successfully',
      payment
    });
  } catch (error) {
    console.error('Error submitting to SWIFT:', error);
    res.status(500).json({ error: 'Failed to submit payment to SWIFT' });
  }
});

// Get admin dashboard stats
router.get('/dashboard/stats', authenticateAdmin, async (req, res) => {
  try {
    const totalPayments = await Payment.countDocuments();
    const pendingPayments = await Payment.countDocuments({ status: 'pending' });
    const approvedPayments = await Payment.countDocuments({ status: 'approved' });
    const swiftPayments = await Payment.countDocuments({ status: 'submitted_to_swift' });
    const rejectedPayments = await Payment.countDocuments({ status: 'rejected' });

    res.json({
      message: 'Dashboard stats retrieved successfully',
      stats: {
        totalPayments,
        pendingPayments,
        approvedPayments,
        swiftPayments,
        rejectedPayments
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Bulk approve payments
router.put('/payments/bulk/approve', authenticateAdmin, async (req, res) => {
  try {
    const { paymentIds } = req.body;
    
    const result = await Payment.updateMany(
      { 
        _id: { $in: paymentIds },
        status: 'pending'
      },
      { 
        status: 'approved',
        verifiedBy: req.user.id,
        verifiedAt: new Date()
      }
    );

    res.json({
      message: `Successfully approved ${result.modifiedCount} payments`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error in bulk approval:', error);
    res.status(500).json({ error: 'Failed to bulk approve payments' });
  }
});

// Bulk submit to SWIFT
router.put('/payments/bulk/submit-swift', authenticateAdmin, async (req, res) => {
  try {
    const { paymentIds } = req.body;
    
    const result = await Payment.updateMany(
      { 
        _id: { $in: paymentIds },
        status: 'approved'
      },
      { 
        status: 'submitted_to_swift',
        submittedToSwiftAt: new Date()
      }
    );

    res.json({
      message: `Successfully submitted ${result.modifiedCount} payments to SWIFT`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error in bulk SWIFT submission:', error);
    res.status(500).json({ error: 'Failed to bulk submit payments to SWIFT' });
  }
});

export default router;