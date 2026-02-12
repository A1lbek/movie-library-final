const User = require('../models/User');

/**
 * Middleware: Require authentication
 * Checks if user is logged in
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  
  // Return 401 for API requests
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Redirect to login for page requests
  res.redirect('/login');
}

/**
 * Middleware: Require admin role
 * Checks if user is logged in AND has admin role
 */
function requireAdmin(req, res, next) {
  // First check authentication
  if (!req.session || !req.session.userId) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return res.redirect('/login');
  }
  
  // Then check admin role
  if (req.session.role !== 'admin') {
    if (req.path.startsWith('/api/')) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    return res.status(403).send('Forbidden: Admin access required');
  }
  
  next();
}

/**
 * Middleware: Attach user object to request
 * Useful for accessing user info in routes
 */
async function attachUser(req, res, next) {
  if (req.session && req.session.userId) {
    try {
      const user = await User.findById(req.session.userId).select('-password');
      req.user = user;
    } catch (error) {
      console.error('Error attaching user:', error);
      // Don't fail the request, just log the error
    }
  }
  next();
}

/**
 * Middleware Factory: Check resource ownership
 * Returns middleware that checks if user owns the resource or is admin
 * 
 * @param {string} resourceType - Type of resource ('movie', etc.)
 * @returns {Function} Express middleware function
 */
function checkOwnership(resourceType) {
  return async (req, res, next) => {
    try {
      // Admin can access everything
      if (req.session.role === 'admin') {
        return next();
      }
      
      // Get the resource based on type
      let resource;
      if (resourceType === 'movie') {
        const Movie = require('../models/Movie');
        resource = await Movie.findById(req.params.id);
      }
      // Add more resource types as needed
      // else if (resourceType === 'review') { ... }
      
      if (!resource) {
        return res.status(404).json({ 
          error: `${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} not found` 
        });
      }
      
      // Check if user owns the resource
      if (resource.createdBy.toString() !== req.session.userId.toString()) {
        return res.status(403).json({ 
          error: `Access denied: You can only modify your own ${resourceType}s` 
        });
      }
      
      // User owns the resource, allow access
      next();
    } catch (error) {
      console.error('Ownership check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Middleware: Attach user role to request
 * Lighter alternative to attachUser when you only need the role
 */
function attachRole(req, res, next) {
  if (req.session && req.session.role) {
    req.userRole = req.session.role;
  } else {
    req.userRole = null;
  }
  next();
}

/**
 * Middleware: Check if user is authenticated
 * Just attaches user role, doesn't require authentication
 */
function isAuthenticated(req, res, next) {
  if (req.session && req.session.role) {
    req.userRole = req.session.role;
  } else {
    req.userRole = null;
  }
  next();
}

module.exports = { 
  requireAuth, 
  requireAdmin, 
  attachUser, 
  checkOwnership,
  attachRole,
  isAuthenticated
};
