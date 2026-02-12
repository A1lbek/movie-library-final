const express = require('express');
const router = express.Router();
const Movie = require('../models/Movie');
const { requireAuth, requireAdmin, checkOwnership } = require('../middleware/auth');

/**
 * GET /api/movies
 * Public endpoint - Get all movies with filtering and pagination
 */
router.get('/', async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Build query filters
    const filters = {};
    
    // Genre filter
    if (req.query.genre) {
      filters.genre = req.query.genre;
    }
    
    // Year filter (exact)
    if (req.query.year) {
      filters.year = parseInt(req.query.year);
    }
    
    // Year range filters
    if (req.query.year_min || req.query.year_max) {
      filters.year = {};
      if (req.query.year_min) {
        filters.year.$gte = parseInt(req.query.year_min);
      }
      if (req.query.year_max) {
        filters.year.$lte = parseInt(req.query.year_max);
      }
    }
    
    // Director filter (case-insensitive partial match)
    if (req.query.director) {
      filters.director = new RegExp(req.query.director, 'i');
    }
    
    // Title search (case-insensitive partial match)
    if (req.query.title) {
      filters.title = new RegExp(req.query.title, 'i');
    }
    
    // Rating filter
    if (req.query.rating_min) {
      filters.rating = { $gte: parseFloat(req.query.rating_min) };
    }
    
    // Get total count for pagination
    const total = await Movie.countDocuments(filters);
    
    // Build sort options
    const sortField = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.order === 'asc' ? 1 : -1;
    const sortOptions = { [sortField]: sortOrder };
    
    // Query movies with population of user references
    const movies = await Movie.find(filters)
      .populate('createdBy', 'username')
      .populate('updatedBy', 'username')
      .sort(sortOptions)
      .limit(limit)
      .skip(skip)
      .lean(); // Use lean() for better performance when we don't need Mongoose documents
    
    res.json({
      movies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total
      }
    });
  } catch (error) {
    console.error('Error fetching movies:', error);
    res.status(500).json({ error: 'Failed to fetch movies' });
  }
});

/**
 * GET /api/movies/:id
 * Public endpoint - Get single movie by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id)
      .populate('createdBy', 'username email')
      .populate('updatedBy', 'username');
    
    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }
    
    res.json(movie);
  } catch (error) {
    console.error('Error fetching movie:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid movie ID format' });
    }
    res.status(500).json({ error: 'Failed to fetch movie' });
  }
});

/**
 * POST /api/movies
 * Protected endpoint - Create new movie (requires authentication)
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, year, director, genre, rating, age_rating, description } = req.body;
    
    // Validate required fields
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    if (!year) {
      return res.status(400).json({ error: 'Year is required' });
    }
    
    const yearNum = parseInt(year);
    if (isNaN(yearNum) || yearNum < 1888 || yearNum > 2030) {
      return res.status(400).json({ error: 'Year must be between 1888 and 2030' });
    }
    
    // Validate rating if provided
    if (rating !== undefined && rating !== null && rating !== '') {
      const ratingNum = parseFloat(rating);
      if (isNaN(ratingNum) || ratingNum < 0 || ratingNum > 10) {
        return res.status(400).json({ error: 'Rating must be between 0 and 10' });
      }
    }
    
    // Create movie document
    const movie = new Movie({
      title: title.trim(),
      year: yearNum,
      director: director?.trim(),
      genre: Array.isArray(genre) ? genre.filter(g => g.trim()) : (genre ? [genre.trim()] : []),
      rating: rating ? parseFloat(rating) : undefined,
      age_rating: age_rating || undefined,
      description: description?.trim(),
      createdBy: req.session.userId,
      updatedBy: req.session.userId
    });
    
    // Save to database
    await movie.save();
    
    // Populate creator info before sending response
    await movie.populate('createdBy', 'username');
    
    res.status(201).json(movie);
  } catch (error) {
    console.error('Error creating movie:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    
    res.status(500).json({ error: 'Failed to create movie' });
  }
});

/**
 * PUT /api/movies/:id
 * Protected endpoint - Update movie (requires ownership or admin role)
 */
router.put('/:id', requireAuth, checkOwnership('movie'), async (req, res) => {
  try {
    const { title, year, director, genre, rating, age_rating, description } = req.body;
    
    // Validate inputs if provided
    if (title !== undefined && !title.trim()) {
      return res.status(400).json({ error: 'Title cannot be empty' });
    }
    
    if (year !== undefined) {
      const yearNum = parseInt(year);
      if (isNaN(yearNum) || yearNum < 1888 || yearNum > 2030) {
        return res.status(400).json({ error: 'Year must be between 1888 and 2030' });
      }
    }
    
    if (rating !== undefined && rating !== null && rating !== '') {
      const ratingNum = parseFloat(rating);
      if (isNaN(ratingNum) || ratingNum < 0 || ratingNum > 10) {
        return res.status(400).json({ error: 'Rating must be between 0 and 10' });
      }
    }
    
    // Build update object (only include provided fields)
    const updateData = {
      updatedBy: req.session.userId
    };
    
    if (title !== undefined) updateData.title = title.trim();
    if (year !== undefined) updateData.year = parseInt(year);
    if (director !== undefined) updateData.director = director.trim();
    if (genre !== undefined) {
      updateData.genre = Array.isArray(genre) ? genre.filter(g => g.trim()) : (genre ? [genre.trim()] : []);
    }
    if (rating !== undefined && rating !== null && rating !== '') {
      updateData.rating = parseFloat(rating);
    }
    if (age_rating !== undefined) updateData.age_rating = age_rating || null;
    if (description !== undefined) updateData.description = description.trim();
    
    // Update movie
    const movie = await Movie.findByIdAndUpdate(
      req.params.id,
      updateData,
      { 
        new: true,  // Return updated document
        runValidators: true  // Run schema validators
      }
    )
    .populate('createdBy', 'username')
    .populate('updatedBy', 'username');
    
    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }
    
    res.json(movie);
  } catch (error) {
    console.error('Error updating movie:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid movie ID format' });
    }
    
    res.status(500).json({ error: 'Failed to update movie' });
  }
});

/**
 * DELETE /api/movies/:id
 * Protected endpoint - Delete movie (requires ownership or admin role)
 */
router.delete('/:id', requireAuth, checkOwnership('movie'), async (req, res) => {
  try {
    const movie = await Movie.findByIdAndDelete(req.params.id);
    
    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }
    
    res.json({ 
      message: 'Movie deleted successfully', 
      movie: {
        _id: movie._id,
        title: movie.title,
        year: movie.year
      }
    });
  } catch (error) {
    console.error('Error deleting movie:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid movie ID format' });
    }
    
    res.status(500).json({ error: 'Failed to delete movie' });
  }
});

// ========== ADMIN-ONLY ROUTES ==========

/**
 * GET /api/movies/admin/all
 * Admin-only endpoint - Get all movies with full user details
 */
router.get('/admin/all', requireAdmin, async (req, res) => {
  try {
    const movies = await Movie.find()
      .populate('createdBy', 'username email role createdAt')
      .populate('updatedBy', 'username email role')
      .sort({ createdAt: -1 });
    
    res.json(movies);
  } catch (error) {
    console.error('Error fetching all movies:', error);
    res.status(500).json({ error: 'Failed to fetch movies' });
  }
});

/**
 * DELETE /api/movies/admin/:id
 * Admin-only endpoint - Delete any movie regardless of ownership
 */
router.delete('/admin/:id', requireAdmin, async (req, res) => {
  try {
    const movie = await Movie.findByIdAndDelete(req.params.id);
    
    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }
    
    res.json({ 
      message: 'Movie deleted by admin', 
      movie: {
        _id: movie._id,
        title: movie.title,
        year: movie.year
      }
    });
  } catch (error) {
    console.error('Error deleting movie (admin):', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid movie ID format' });
    }
    
    res.status(500).json({ error: 'Failed to delete movie' });
  }
});

/**
 * GET /api/movies/stats
 * Public endpoint - Get movie statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const totalMovies = await Movie.countDocuments();
    const moviesByYear = await Movie.aggregate([
      { $group: { _id: '$year', count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
      { $limit: 10 }
    ]);
    
    const moviesByGenre = await Movie.aggregate([
      { $unwind: '$genre' },
      { $group: { _id: '$genre', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    res.json({
      total: totalMovies,
      byYear: moviesByYear,
      byGenre: moviesByGenre
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;
