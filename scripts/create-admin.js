require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const crypto = require('crypto');

/**
 * Create Admin User Script
 * Run this script to create an initial admin user
 * Usage: node scripts/create-admin.js
 */

async function createAdmin() {
  try {
    console.log('Connecting to MongoDB...');
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const dbName = process.env.MONGODB_DB || 'movie-db';
    console.log('Target URI:', uri);
    console.log('Target DB:', dbName);
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName
    });
    console.log('Connected to MongoDB', mongoose.connection.name);
    
    // Admin credentials (CHANGE THESE IN PRODUCTION!)
    const adminUsername = 'admin';
    const adminPassword = 'Admin123!';
    const adminEmail = 'admin@movielibrary.com';
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ username: adminUsername });
    if (existingAdmin) {
      console.log('❌ Admin user already exists');
      console.log('Username:', existingAdmin.username);
      console.log('Role:', existingAdmin.role);
      
      // Optionally update to admin role if not already
      if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin';
        await existingAdmin.save();
        console.log('✅ Updated existing user to admin role');
      }
      
      await mongoose.connection.close();
      process.exit(0);
    }
    
    // Hash password using same method as User model
    const hashedPassword = User.hashPassword(adminPassword);
    
    // Create admin user
    const admin = new User({
      username: adminUsername,
      password: hashedPassword,
      email: adminEmail,
      role: 'admin'
    });
    
    await admin.save();
    
    console.log('✅ Admin user created successfully!');
    console.log('');
    console.log('==========================================');
    console.log('Admin Credentials:');
    console.log('Username:', adminUsername);
    console.log('Password:', adminPassword);
    console.log('Email:', adminEmail);
    console.log('==========================================');
    console.log('');
    console.log('⚠️  IMPORTANT: Change the admin password immediately after first login!');
    console.log('⚠️  DO NOT commit these credentials to version control!');
    console.log('');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the script
createAdmin();
