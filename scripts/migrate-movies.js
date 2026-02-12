require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Movie = require('../models/Movie');
const User = require('../models/User');

/**
 * Movie Migration Script
 * Migrates movies from JSON file to MongoDB
 * Usage: node scripts/migrate-movies.js
 */

async function migrateMovies() {
  try {
    console.log('Starting movie migration...');
    console.log('Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/movie-library', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');
    
    // Get admin user (will be the creator of migrated movies)
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.error('❌ No admin user found. Please run create-admin.js first.');
      await mongoose.connection.close();
      process.exit(1);
    }
    console.log(`✅ Found admin user: ${admin.username}`);
    
    // Read existing JSON data
    const jsonPath = path.join(__dirname, '../data/movies.json');
    
    if (!fs.existsSync(jsonPath)) {
      console.error(`❌ Movies JSON file not found at: ${jsonPath}`);
      await mongoose.connection.close();
      process.exit(1);
    }
    
    const fileContent = fs.readFileSync(jsonPath, 'utf8');
    const moviesData = JSON.parse(fileContent);
    
    console.log(`📚 Found ${moviesData.length} movies in JSON file`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const movieData of moviesData) {
      try {
        // Check if movie already exists (by title and year)
        const exists = await Movie.findOne({ 
          title: movieData.title, 
          year: movieData.year 
        });
        
        if (exists) {
          console.log(`⏭️  Skipping duplicate: ${movieData.title} (${movieData.year})`);
          skippedCount++;
          continue;
        }
        
        // Create new movie
        const movie = new Movie({
          title: movieData.title,
          year: movieData.year,
          director: movieData.director,
          genre: Array.isArray(movieData.genre) ? movieData.genre : [movieData.genre].filter(Boolean),
          rating: movieData.rating,
          age_rating: movieData.age_rating,
          description: movieData.description,
          createdBy: admin._id,
          updatedBy: admin._id
        });
        
        await movie.save();
        console.log(`✅ Migrated: ${movieData.title} (${movieData.year})`);
        migratedCount++;
      } catch (error) {
        console.error(`❌ Error migrating "${movieData.title}":`, error.message);
        errorCount++;
      }
    }
    
    console.log('');
    console.log('==========================================');
    console.log('Migration Complete!');
    console.log('==========================================');
    console.log(`✅ Successfully migrated: ${migratedCount} movies`);
    console.log(`⏭️  Skipped (duplicates): ${skippedCount} movies`);
    console.log(`❌ Errors: ${errorCount} movies`);
    console.log(`📊 Total in database: ${await Movie.countDocuments()} movies`);
    console.log('==========================================');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the migration
migrateMovies();
