const mongoose = require('mongoose');

const MovieSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: [true, 'Title is required'],
    trim: true,
    minlength: [1, 'Title cannot be empty']
  },
  year: { 
    type: Number, 
    required: [true, 'Year is required'],
    min: [1888, 'Year must be at least 1888'],
    max: [2030, 'Year cannot exceed 2030']
  },
  director: { 
    type: String,
    trim: true 
  },
  genre: [{
    type: String,
    trim: true 
  }],
  rating: { 
    type: Number,
    min: [0, 'Rating must be at least 0'],
    max: [10, 'Rating cannot exceed 10']
  },
  age_rating: { 
    type: String,
    enum: ['0+', '6+', '12+', '16+', '18+', null]
  },
  description: { 
    type: String 
  },
  // Relationship: Movie belongs to a User (creator)
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: [true, 'Creator is required']
  },
  // Track who last updated the movie
  updatedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }
}, {
  // Automatically manage createdAt and updatedAt
  timestamps: true
});

// Create indexes for better query performance
MovieSchema.index({ title: 'text', director: 'text' });
MovieSchema.index({ year: 1 });
MovieSchema.index({ genre: 1 });
MovieSchema.index({ createdBy: 1 });
MovieSchema.index({ rating: 1 });

module.exports = mongoose.model('Movie', MovieSchema);
