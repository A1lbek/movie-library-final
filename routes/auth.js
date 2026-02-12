const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { redirectIfAuthenticated } = require('../middleware/auth');

let db;
let usersCollection;

function initializeDb(database) {
  db = database;
  if (db) {
    usersCollection = db.collection('users');
  }
}

router.post('/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    const errors = User.validateUserData(username, password, email);
    if (errors.length > 0) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors 
      });
    }

    if (!usersCollection) {
      return res.status(503).json({ 
        error: 'Database unavailable' 
      });
    }

    const existingUser = await usersCollection.findOne({ 
      username: username.trim() 
    });

    if (existingUser) {
      return res.status(400).json({ 
        error: 'Username already exists' 
      });
    }

    const newUser = User.createUserObject(username, password, email);
    const result = await usersCollection.insertOne(newUser);

    req.session.userId = result.insertedId.toString();
    req.session.user = {
      username: newUser.username,
      email: newUser.email
    };
    req.sessionSave();

    res.status(201).json({ 
      message: 'User registered successfully',
      user: User.sanitizeUser({
        _id: result.insertedId,
        ...newUser
      })
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'Registration failed' 
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Invalid credentials' 
      });
    }

    if (!usersCollection) {
      return res.status(503).json({ 
        error: 'Database unavailable' 
      });
    }

    const user = await usersCollection.findOne({ 
      username: username.trim() 
    });

    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid credentials' 
      });
    }

    const isPasswordValid = User.verifyPassword(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ 
        error: 'Invalid credentials' 
      });
    }

    req.session.userId = user._id.toString();
    req.session.user = {
      username: user.username,
      email: user.email
    };
    req.sessionSave();

    res.json({ 
      message: 'Login successful',
      user: User.sanitizeUser(user)
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Login failed' 
    });
  }
});

router.post('/logout', (req, res) => {
  req.sessionDestroy();
  res.json({ message: 'Logout successful' });
});

router.get('/me', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ 
        error: 'Not authenticated' 
      });
    }

    if (!usersCollection) {
      return res.status(503).json({ 
        error: 'Database unavailable' 
      });
    }

    const { ObjectId } = require('mongodb');
    const user = await usersCollection.findOne({ 
      _id: new ObjectId(req.session.userId) 
    });

    if (!user) {
      req.sessionDestroy();
      return res.status(401).json({ 
        error: 'User not found' 
      });
    }

    res.json({ 
      user: User.sanitizeUser(user)
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ 
      error: 'Failed to get user data' 
    });
  }
});

module.exports = { router, initializeDb };
