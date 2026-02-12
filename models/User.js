const mongoose = require('mongoose');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true, 
    minlength: 3,
    trim: true
  },
  password: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String,
    lowercase: true,
    trim: true
  },
  role: { 
    type: String, 
    enum: ['user', 'admin'], 
    default: 'user'
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Update the updatedAt timestamp before saving
UserSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

/**
 * Static method: Validate user data for registration
 * Returns array of error messages
 */
UserSchema.statics.validateUserData = function(username, password, email) {
  const errors = [];
  
  if (!username || username.trim().length < 3) {
    errors.push('Username must be at least 3 characters long');
  }
  
  if (!password || password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }
  
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Invalid email format');
  }
  
  return errors;
};

/**
 * Static method: Hash password for new user using PBKDF2
 */
UserSchema.statics.hashPassword = function(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha256').toString('hex');
  return `${salt}:${hash}`;
};

/**
 * Static method: Verify password against hash
 */
UserSchema.statics.verifyPassword = function(password, hashedPassword) {
  const [salt, hash] = hashedPassword.split(':');
  const hashCheck = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha256').toString('hex');
  return hash === hashCheck;
};

/**
 * Static method: Create new user object with hashed password
 */
UserSchema.statics.createUserObject = function(username, password, email) {
  const hashedPassword = this.hashPassword(password);
  
  return {
    username: username.trim(),
    password: hashedPassword,
    email: email ? email.trim().toLowerCase() : null,
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date()
  };
};

/**
 * Static method: Sanitize user object (remove sensitive data)
 */
UserSchema.statics.sanitizeUser = function(user) {
  const sanitized = user.toObject ? user.toObject() : { ...user };
  delete sanitized.password;
  return sanitized;
};

module.exports = mongoose.model('User', UserSchema);
