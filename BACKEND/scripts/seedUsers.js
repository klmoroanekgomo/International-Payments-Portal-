import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Payment from '../models/Payment.js';
import 'dotenv/config';

// Pre-created users (NO REGISTRATION - as per requirements)
const users = [
  {
    username: 'admin_user',
    email: 'admin@company.com',
    password: 'Admin123!@#',
    role: 'admin'
  },
  {
    username: 'john_doe',
    email: 'john.doe@company.com',
    password: 'SecurePass123!',
    role: 'employee'
  },
  {
    username: 'jane_smith',
    email: 'jane.smith@company.com',
    password: 'AnotherSecure456!',
    role: 'employee'
  }
];

async function seedUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Payment.deleteMany({});

    console.log('Seeding users...');

    // Create users with hashed passwords
    const createdUsers = [];
    for (const userData of users) {
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      
      const user = new User({
        username: userData.username,
        email: userData.email,
        password: hashedPassword,
        role: userData.role
      });

      await user.save();
      createdUsers.push(user);
      console.log(`Created user: ${user.username}`);
    }

    // Seed sample payments
    const samplePayments = [
      {
        userId: createdUsers[1]._id, // john_doe
        recipientName: 'Global Suppliers Inc',
        recipientAccount: 'US12345678901234567890',
        recipientBankSwift: 'BOFAUS3N',
        amount: 15000.00,
        currency: 'USD',
        description: 'Q3 Invoice Payment',
        status: 'completed'
      },
      {
        userId: createdUsers[2]._id, // jane_smith
        recipientName: 'Euro Partners GmbH',
        recipientAccount: 'DE89370400440532013000',
        recipientBankSwift: 'DEUTDEFF',
        amount: 25000.50,
        currency: 'EUR',
        description: 'Equipment Purchase',
        status: 'pending'
      }
    ];

    for (const paymentData of samplePayments) {
      const payment = new Payment(paymentData);
      await payment.save();
      console.log(`Created payment for: ${payment.recipientName}`);
    }

    console.log('Seeding completed successfully!');
    
  } catch (error) {
    console.error('Seeding error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

seedUsers();