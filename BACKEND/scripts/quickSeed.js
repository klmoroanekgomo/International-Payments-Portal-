import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

async function quickSeed() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing users without dropping database
    await mongoose.connection.db.collection('users').deleteMany({});
    console.log('Cleared existing users');

    // Create users
    const users = [
      {
        username: 'admin_user',
        email: 'admin@company.com',
        password: await bcrypt.hash('Admin123!@#', 12),
        role: 'admin',
        createdAt: new Date()
      },
      {
        username: 'john_doe',
        email: 'john.doe@company.com',
        password: await bcrypt.hash('SecurePass123!', 12),
        role: 'employee',
        createdAt: new Date()
      },
      {
        username: 'jane_smith',
        email: 'jane.smith@company.com', 
        password: await bcrypt.hash('AnotherSecure456!', 12),
        role: 'employee',
        createdAt: new Date()
      }
    ];

    // Insert users
    const result = await mongoose.connection.db.collection('users').insertMany(users);
    console.log('Users created:', result.insertedCount);
    
    console.log('Seeding completed successfully!');
    console.log('Login credentials:');
    console.log('- admin_user / Admin123!@#');
    console.log('- john_doe / SecurePass123!');
    console.log('- jane_smith / AnotherSecure456!');
    
  } catch (error) {
    console.error('Seeding error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

quickSeed();