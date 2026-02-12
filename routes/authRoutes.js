const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');

// In-memory session store (for development - use MongoDB/Redis in production)
const sessions = new Map();

// Session configuration
const SESSION_MAX_AGE = process.env.SESSION_MAX_AGE || 86400000; // 24 hours
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-secret-in-production';

/**
 * Generate a secure session ID
 */
function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Sign a session ID with HMAC
 */
function signSessionId(sessionId) {
  const hmac = crypto.createHmac('sha256', SESSION_SECRET);
  hmac.update(sessionId);
  return hmac.digest('hex');
}

/**
 * Verify session ID signature
 */
function verifySessionId(sessionId, signature) {
  const expectedSignature = signSessionId(sessionId);
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

/**
 * Middleware to parse session from cookie
 */
router.use((req, res, next) => {
  const cookie = req.headers.cookie;
  if (cookie) {
    const match = cookie.match(/sessionId=([^;]+)/);
    if (match) {
      const [sessionId, signature] = match[1].split('.');
      if (sessionId && signature && verifySessionId(sessionId, signature)) {
        const session = sessions.get(sessionId);
        if (session && session.expiresAt > Date.now()) {
          req.session = session.data;
          req.sessionId = sessionId;
          return next();
        } else {
          sessions.delete(sessionId); // Clean up expired session
        }
      }
    }
  }
  req.session = null;
  next();
});

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    
    // Validation
    if (!username || username.trim().length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ username: username.trim() });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    // Hash password using PBKDF2
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    const hashedPassword = `${salt}:${hash}`;
    
    // Create new user (role defaults to 'user')
    const user = new User({
      username: username.trim(),
      password: hashedPassword,
      email: email?.trim(),
      role: 'user' // Default role
    });
    
    await user.save();
    
    // Auto-login: Create session
    const sessionId = generateSessionId();
    const signature = signSessionId(sessionId);
    
    sessions.set(sessionId, {
      data: {
        userId: user._id.toString(),
        username: user.username,
        role: user.role
      },
      expiresAt: Date.now() + SESSION_MAX_AGE
    });
    
    // Set cookie
    res.cookie('sessionId', `${sessionId}.${signature}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: SESSION_MAX_AGE
    });
    
    res.status(201).json({ 
      message: 'User registered successfully', 
      user: { 
        id: user._id, 
        username: user.username,
        role: user.role
      } 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Find user
    const user = await User.findOne({ username: username.trim() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Verify password
    const [salt, storedHash] = user.password.split(':');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    
    // Use constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Create session
    const sessionId = generateSessionId();
    const signature = signSessionId(sessionId);
    
    sessions.set(sessionId, {
      data: {
        userId: user._id.toString(),
        username: user.username,
        role: user.role  // IMPORTANT: Include role in session
      },
      expiresAt: Date.now() + SESSION_MAX_AGE
    });
    
    // Set cookie
    res.cookie('sessionId', `${sessionId}.${signature}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: SESSION_MAX_AGE
    });
    
    res.json({ 
      message: 'Login successful', 
      user: { 
        id: user._id, 
        username: user.username,
        role: user.role  // IMPORTANT: Return role to client
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/logout
 * Logout user
 */
router.post('/logout', (req, res) => {
  if (req.sessionId) {
    sessions.delete(req.sessionId);
  }
  
  res.clearCookie('sessionId');
  res.json({ message: 'Logout successful' });
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({ 
      userId: req.session.userId, 
      username: req.session.username,
      role: req.session.role || 'user'  // IMPORTANT: Include role
    });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

/**
 * GET /api/auth/users (Admin only)
 * Get all users
 */
router.get('/users', async (req, res) => {
  try {
    // Check admin permission
    if (!req.session || req.session.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const users = await User.find()
      .select('-password')  // Exclude password field
      .sort({ createdAt: -1 });
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * Cleanup expired sessions (runs every hour)
 */
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      sessions.delete(sessionId);
    }
  }
  console.log(`Cleaned up expired sessions. Active sessions: ${sessions.size}`);
}, 3600000); // 1 hour

module.exports = router;
