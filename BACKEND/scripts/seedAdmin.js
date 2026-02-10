import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import 'dotenv/config';

const mongoURI = process.env.MONGODB_URI;

async function createAdminUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    // Hash passwords
    const adminPassword = await bcrypt.hash('admin123', 12);
    const employeePassword = await bcrypt.hash('employee123', 12);

    // Admin user data
    const adminUser = {
      username: 'admin',
      password: adminPassword,
      email: 'admin@bank.com',
      fullName: 'System Administrator',
      idNumber: 'ADMIN001',
      accountNumber: '00000001',
      role: 'admin',
      createdAt: new Date()
    };

    // Employee user data
    const employeeUser = {
      username: 'employee',
      password: employeePassword,
      email: 'employee@bank.com',
      fullName: 'Bank Employee',
      idNumber: 'EMP001',
      accountNumber: '00000002',
      role: 'employee',
      createdAt: new Date()
    };

    // Import User model
    const User = (await import('../models/User.js')).default;

    // Check if users already exist
    const existingAdmin = await User.findOne({ username: 'admin' });
    const existingEmployee = await User.findOne({ username: 'employee' });

    if (!existingAdmin) {
      await User.create(adminUser);
      console.log('✅ Admin user created:');
      console.log('   Username: admin');
      console.log('   Password: admin123');
      console.log('   Role: admin');
    } else {
      console.log('ℹ️ Admin user already exists');
    }

    if (!existingEmployee) {
      await User.create(employeeUser);
      console.log('✅ Employee user created:');
      console.log('   Username: employee');
      console.log('   Password: employee123');
      console.log('   Role: employee');
    } else {
      console.log('ℹ️ Employee user already exists');
    }

    console.log('🎉 Seed completed successfully!');
    
  } catch (error) {
    console.error('Error creating admin users:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the seed function
createAdminUsers();