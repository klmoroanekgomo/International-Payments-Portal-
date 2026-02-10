import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import 'dotenv/config';

const mongoURI = process.env.MONGODB_URI;

async function createTestCustomers() {
  try {
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    const customerPassword = await bcrypt.hash('customer123', 12);

    const testCustomers = [
      {
        username: 'john_doe',
        password: customerPassword,
        email: 'john@example.com',
        fullName: 'John Doe',
        idNumber: 'CUST001',
        accountNumber: '10000001',
        role: 'customer',
        createdAt: new Date()
      },
      {
        username: 'jane_smith',
        password: customerPassword,
        email: 'jane@example.com',
        fullName: 'Jane Smith',
        idNumber: 'CUST002',
        accountNumber: '10000002',
        role: 'customer',
        createdAt: new Date()
      }
    ];

    const User = (await import('../models/User.js')).default;

    for (const customer of testCustomers) {
      const existingUser = await User.findOne({ username: customer.username });
      
      if (!existingUser) {
        await User.create(customer);
        console.log(`✅ Customer created: ${customer.username}`);
      } else {
        console.log(`ℹ️ Customer already exists: ${customer.username}`);
      }
    }

    console.log('🎉 Customer seed completed!');
    console.log('Test customer credentials:');
    console.log('   Username: john_doe / jane_smith');
    console.log('   Password: customer123');
    
  } catch (error) {
    console.error('Error creating customers:', error);
  } finally {
    await mongoose.connection.close();
  }
}

createTestCustomers();