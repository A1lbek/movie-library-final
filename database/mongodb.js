const { MongoClient } = require('mongodb');

let client;
let db;

async function connectToDatabase() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    console.log('Trying to connect to MongoDB at:', uri);
    
    client = new MongoClient(uri);
    await client.connect();
    
    db = client.db('movie-db');
    console.log('Connected to MongoDB');
    
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    console.log('Make sure MongoDB is running on port 27017');
  }
}

function getMoviesCollection() {
  if (!db) throw new Error('Database not connected');
  return db.collection('movies');
}

module.exports = { connectToDatabase, getMoviesCollection };