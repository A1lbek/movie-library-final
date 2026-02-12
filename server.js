require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { connectToDatabase } = require('./database/mongodb');
const { router: authRouter, initializeDb: initAuthDb } = require('./routes/auth');
const { requireAuth, isAuthenticated } = require('./middleware/auth');
const SimpleSession = require('./middleware/simpleSession');

const app = express();
const PORT = process.env.PORT || 3000;

const sessionManager = new SimpleSession({
  secret: process.env.SESSION_SECRET || 'movie-library-secret-change-in-production',
  cookieName: 'movielib_session',
  maxAge: 24 * 60 * 60 * 1000 
});

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(sessionManager.middleware());

app.use(isAuthenticated);

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const authStatus = req.session.userId ? '+' : '-';
  console.log(`${authStatus} [${timestamp}] ${req.method} ${req.url}`);
  next();
});

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const moviesFilePath = path.join(dataDir, 'movies.json');
const messagesFilePath = path.join(dataDir, 'messages.json');

function readMoviesFromFile() {
  try {
    if (!fs.existsSync(moviesFilePath)) return [];
    const data = fs.readFileSync(moviesFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function writeMoviesToFile(movies) {
  try {
    fs.writeFileSync(moviesFilePath, JSON.stringify(movies, null, 2), 'utf8');
    return true;
  } catch (error) {
    return false;
  }
}

function readMessagesFromFile() {
  try {
    if (!fs.existsSync(messagesFilePath)) return [];
    const data = fs.readFileSync(messagesFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function writeMessagesToFile(messages) {
  try {
    fs.writeFileSync(messagesFilePath, JSON.stringify(messages, null, 2), 'utf8');
    return true;
  } catch (error) {
    return false;
  }
}

function generateMovieId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function validateMovieData(req, res, next) {
  const { title, year } = req.body;
  
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ error: 'Title is required and must be a non-empty string' });
  }
  
  if (!year) {
    return res.status(400).json({ error: 'Year is required' });
  }
  
  const yearNum = parseInt(year);
  if (isNaN(yearNum) || yearNum < 1888 || yearNum > new Date().getFullYear() + 5) {
    return res.status(400).json({ error: 'Invalid year' });
  }
  
  next();
}

app.use('/api/auth', authRouter);
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/register', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'about.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'contact.html'));
});

app.get('/api/movies', (req, res) => {
  try {
    const movies = readMoviesFromFile();
    let filteredMovies = [...movies];

    if (req.query.genre) {
      const searchGenre = req.query.genre.toLowerCase();
      filteredMovies = filteredMovies.filter(movie => 
        movie.genre && movie.genre.some(g => g.toLowerCase().includes(searchGenre))
      );
    }

    if (req.query.year) {
      const year = parseInt(req.query.year);
      if (!isNaN(year)) {
        filteredMovies = filteredMovies.filter(movie => movie.year === year);
      }
    }

    if (req.query.director) {
      const searchDirector = req.query.director.toLowerCase();
      filteredMovies = filteredMovies.filter(movie => 
        movie.director && movie.director.toLowerCase().includes(searchDirector)
      );
    }

    if (req.query.title) {
      const searchTitle = req.query.title.toLowerCase();
      filteredMovies = filteredMovies.filter(movie => 
        movie.title && movie.title.toLowerCase().includes(searchTitle)
      );
    }

    if (req.query.year_min) {
      const yearMin = parseInt(req.query.year_min);
      if (!isNaN(yearMin)) {
        filteredMovies = filteredMovies.filter(movie => movie.year >= yearMin);
      }
    }

    if (req.query.year_max) {
      const yearMax = parseInt(req.query.year_max);
      if (!isNaN(yearMax)) {
        filteredMovies = filteredMovies.filter(movie => movie.year <= yearMax);
      }
    }

    if (req.query.sortBy) {
      const sortField = req.query.sortBy;
      const sortOrder = req.query.order === 'desc' ? -1 : 1;
      filteredMovies.sort((a, b) => {
        if (a[sortField] < b[sortField]) return -1 * sortOrder;
        if (a[sortField] > b[sortField]) return 1 * sortOrder;
        return 0;
      });
    }

    if (req.query.fields) {
      const fields = req.query.fields.split(',');
      filteredMovies = filteredMovies.map(movie => {
        const projectedMovie = {};
        fields.forEach(field => {
          const trimmedField = field.trim();
          if (movie.hasOwnProperty(trimmedField)) {
            projectedMovie[trimmedField] = movie[trimmedField];
          }
        });
        if (!projectedMovie._id && movie._id) projectedMovie._id = movie._id;
        return projectedMovie;
      });
    }

    res.json({
      count: filteredMovies.length,
      movies: filteredMovies
    });
  } catch (error) {
    console.error('Error fetching movies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/movies/:id', (req, res) => {
  try {
    const movies = readMoviesFromFile();
    const movie = movies.find(m => m._id === req.params.id);
    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }
    res.json(movie);
  } catch (error) {
    console.error('Error fetching movie:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/movies', requireAuth, validateMovieData, (req, res) => {
  try {
    const { title, year, director, genre, rating, age_rating, description } = req.body;
    
    const movies = readMoviesFromFile();
    
    const newMovie = {
      _id: generateMovieId(),
      title: title.trim(),
      year: parseInt(year),
      director: director ? director.trim() : 'Unknown',
      genre: Array.isArray(genre) ? genre : (genre ? [genre] : ['Unknown']),
      rating: rating ? parseFloat(rating) : null,
      age_rating: age_rating || null,
      description: description ? description.trim() : '',
      createdBy: req.session.user.username,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    movies.push(newMovie);
    
    if (writeMoviesToFile(movies)) {
      res.status(201).json(newMovie);
    } else {
      res.status(500).json({ error: 'Failed to save movie' });
    }
  } catch (error) {
    console.error('Error creating movie:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/movies/:id', requireAuth, validateMovieData, (req, res) => {
  try {
    const { id } = req.params;
    const { title, year, director, genre, rating, age_rating, description } = req.body;
    
    const movies = readMoviesFromFile();
    const movieIndex = movies.findIndex(m => m._id === id);
    
    if (movieIndex === -1) {
      return res.status(404).json({ error: 'Movie not found' });
    }
    
    const updatedMovie = {
      ...movies[movieIndex],
      title: title ? title.trim() : movies[movieIndex].title,
      year: year ? parseInt(year) : movies[movieIndex].year,
      director: director ? director.trim() : movies[movieIndex].director,
      genre: genre ? (Array.isArray(genre) ? genre : [genre]) : movies[movieIndex].genre,
      rating: rating !== undefined ? parseFloat(rating) : movies[movieIndex].rating,
      age_rating: age_rating !== undefined ? age_rating : movies[movieIndex].age_rating,
      description: description !== undefined ? description.trim() : movies[movieIndex].description,
      updatedBy: req.session.user.username,
      updatedAt: new Date().toISOString()
    };
    
    movies[movieIndex] = updatedMovie;
    
    if (writeMoviesToFile(movies)) {
      res.json(updatedMovie);
    } else {
      res.status(500).json({ error: 'Failed to update movie' });
    }
  } catch (error) {
    console.error('Error updating movie:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/movies/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    
    const movies = readMoviesFromFile();
    const movieIndex = movies.findIndex(m => m._id === id);
    
    if (movieIndex === -1) {
      return res.status(404).json({ error: 'Movie not found' });
    }
    
    const deletedMovie = movies.splice(movieIndex, 1)[0];
    
    if (writeMoviesToFile(movies)) {
      res.json({ 
        message: 'Movie deleted successfully', 
        deletedMovie,
        deletedBy: req.session.user.username
      });
    } else {
      res.status(500).json({ error: 'Failed to delete movie' });
    }
  } catch (error) {
    console.error('Error deleting movie:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/seed', (req, res) => {
  try {
    const movies = readMoviesFromFile();
    res.json({ 
      message: 'Movies loaded from file', 
      count: movies.length,
      movies: movies
    });
  } catch (error) {
    console.error('Error seeding:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).send('Enter search term');
    }
    
    const movies = readMoviesFromFile();
    const results = movies.filter(m => 
      m.title.toLowerCase().includes(q.toLowerCase()) ||
      (m.description && m.description.toLowerCase().includes(q.toLowerCase()))
    );
    
    let html = `<h1>Search results for: ${q}</h1>`;
    results.forEach(m => {
      html += `<div style="border:1px solid #ccc;padding:15px;margin:10px;border-radius:5px;">
        <h3>${m.title} (${m.year})</h3>
        <p><strong>Director:</strong> ${m.director}</p>
        <p><strong>Genre:</strong> ${m.genre.join(', ')}</p>
        <p><strong>Rating:</strong> ${m.rating}/10</p>
        <p>${m.description ? (m.description.substring(0, 100) + '...') : 'No description'}</p>
        <a href="/item/${m._id}">View details</a></div>`;
    });
    if (results.length === 0) html += '<p>No movies found</p>';
    html += '<br><a href="/">← Back to Home</a>';
    res.send(html);
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).send('Internal server error');
  }
});

app.get('/item/:id', (req, res) => {
  try {
    const { id } = req.params;
    const movies = readMoviesFromFile();
    const movie = movies.find(m => m._id === id);
    
    if (!movie) {
      return res.status(404).send('Movie not found');
    }
    
    res.send(`
      <html>
        <head>
          <title>${movie.title}</title>
          <style>
            body { font-family: Arial; margin: 40px; }
            .movie-card { max-width: 800px; margin: 0 auto; }
            .api-link { color: #667eea; }
          </style>
        </head>
        <body>
          <div class="movie-card">
            <h1>${movie.title} (${movie.year})</h1>
            <p><strong>Director:</strong> ${movie.director}</p>
            <p><strong>Genre:</strong> ${movie.genre.join(', ')}</p>
            <p><strong>Rating:</strong> ${movie.rating}/10</p>
            <p><strong>Age Rating:</strong> ${movie.age_rating}</p>
            <p>${movie.description || 'No description available'}</p>
            <a href="/">← Back to Home</a>
            <br><br>
            <a href="/api/movies/${movie._id}" class="api-link" target="_blank">View JSON API data</a>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error displaying movie:', error);
    res.status(500).send('Internal server error');
  }
});

app.post('/contact', (req, res) => {
  try {
    const { name, email, message } = req.body;
    
    if (!name || !email || !message) {
      return res.status(400).send('All fields are required');
    }
    
    const messages = readMessagesFromFile();
    const newMessage = {
      id: messages.length + 1,
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
      timestamp: new Date().toISOString()
    };
    
    messages.push(newMessage);
    
    if (writeMessagesToFile(messages)) {
      res.send(`<h2>Thank you ${name}!</h2><a href="/">← Home</a>`);
    } else {
      res.status(500).send('Failed to save message');
    }
  } catch (error) {
    console.error('Error saving contact message:', error);
    res.status(500).send('Internal server error');
  }
});

app.get('/api/messages', (req, res) => {
  try {
    const messages = readMessagesFromFile();
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/info', (req, res) => {
  try {
    const movies = readMoviesFromFile();
    res.json({ 
      project: 'Movie Library', 
      version: '4.0 - with Authentication', 
      movieCount: movies.length,
      authenticated: !!req.session.userId,
      user: req.session.user || null
    });
  } catch (error) {
    console.error('Error fetching info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function startServer() {
  try {
    const db = await connectToDatabase();
    if (db) {
      initAuthDb(db);
      console.log('MongoDB connected - authentication enabled');
    } else {
      console.log('MongoDB unavailable - authentication disabled');
    }
  } catch (error) {
    console.log('Starting without MongoDB - authentication disabled');
  }

  app.listen(PORT, () => {
    console.log(`\nMovie Library Server v4.0`);
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`\nAPI Endpoints:`);
    console.log('   Public:');
    console.log('      GET    /api/movies           - All movies (with filtering)');
    console.log('      GET    /api/movies/:id       - Movie by ID');
    console.log('   Protected (requires login):');
    console.log('      POST   /api/movies           - Create movie');
    console.log('      PUT    /api/movies/:id       - Update movie');
    console.log('      DELETE /api/movies/:id       - Delete movie');
    console.log('   Authentication:');
    console.log('      POST   /api/auth/register    - Register new user');
    console.log('      POST   /api/auth/login       - Login');
    console.log('      POST   /api/auth/logout      - Logout');
    console.log('      GET    /api/auth/me          - Current user info');
    console.log('\nPages:');
    console.log('   /         - Homepage');
    console.log('   /login    - Login page');
    console.log('   /register - Registration page');
    console.log('   /about    - About page');
    console.log('   /contact  - Contact page');

    if (!fs.existsSync(moviesFilePath)) {
      writeMoviesToFile([]);
    }
  });
}

startServer();