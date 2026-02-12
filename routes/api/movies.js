const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getMoviesCollection } = require('../../database/mongodb');

const isValidObjectId = (id) => {
  return ObjectId.isValid(id) && (String)(new ObjectId(id)) === id;
};

router.get('/', async (req, res) => {
  try {
    const collection = getMoviesCollection();
    let query = {};
    let sort = {};
    let projection = {};

    if (req.query.genre) query.genre = req.query.genre;
    if (req.query.year) query.year = parseInt(req.query.year);
    if (req.query.year_min) query.year = { $gte: parseInt(req.query.year_min) };
    if (req.query.year_max) query.year = { ...query.year, $lte: parseInt(req.query.year_max) };
    if (req.query.director) query.director = { $regex: req.query.director, $options: 'i' };
    if (req.query.title) query.title = { $regex: req.query.title, $options: 'i' };

    if (req.query.sortBy) {
      const order = req.query.order === 'desc' ? -1 : 1;
      sort[req.query.sortBy] = order;
    } else {
      sort.title = 1;
    }

    if (req.query.fields) {
      const fields = req.query.fields.split(',');
      fields.forEach(field => {
        projection[field] = 1;
      });
    }

    const movies = await collection
      .find(query)
      .project(projection)
      .sort(sort)
      .toArray();
    
    res.status(200).json({
      count: movies.length,
      movies
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    const collection = getMoviesCollection();
    const movie = await collection.findOne({ 
      _id: new ObjectId(req.params.id) 
    });

    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    res.status(200).json(movie);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, year, director, genre, duration, rating, description } = req.body;

    if (!title || !year || !director || !genre) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, year, director, genre' 
      });
    }

    if (isNaN(year)) {
      return res.status(400).json({ error: 'Year must be a number' });
    }

    const collection = getMoviesCollection();
    const movie = {
      title,
      year: parseInt(year),
      director,
      genre: Array.isArray(genre) ? genre : [genre],
      duration: duration ? parseInt(duration) : null,
      rating: rating ? parseFloat(rating) : null,
      description: description || '',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await collection.insertOne(movie);
    
    res.status(201).json({
      _id: result.insertedId,
      ...movie
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    const collection = getMoviesCollection();
    
    const existingMovie = await collection.findOne({ 
      _id: new ObjectId(req.params.id) 
    });

    if (!existingMovie) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    const updateData = { 
      ...req.body, 
      updatedAt: new Date() 
    };
    
    delete updateData._id;
    delete updateData.createdAt;

    if (updateData.genre && !Array.isArray(updateData.genre)) {
      updateData.genre = [updateData.genre];
    }

    const result = await collection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData }
    );

    res.status(200).json({ 
      message: 'Movie updated successfully',
      modifiedCount: result.modifiedCount 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    const collection = getMoviesCollection();
    const result = await collection.deleteOne({ 
      _id: new ObjectId(req.params.id) 
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    res.status(200).json({ 
      message: 'Movie deleted successfully',
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;