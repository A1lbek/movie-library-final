# Movie Library - Assignment 4: Authentication & Security

## Overview
This is the Movie Library application enhanced with session-based authentication, password security, and protected CRUD operations.

## Key Features Implemented

### 1. Authentication System
- **Session-based authentication** (NOT JWT)
- Login and registration via Web UI
- Session ID stored in secure cookies
- Sessions persist between requests
- Custom session implementation (since express-session was unavailable)

### 2. Security Features

#### Password Security
- Passwords hashed using **PBKDF2** (crypto module with 10,000 iterations)
- No plain-text password storage
- Salt generated per password
- Generic error messages ("Invalid credentials")

#### Cookie Security
- **HttpOnly flag**: Enabled (prevents JavaScript access)
- **Secure flag**: Enabled in production (HTTPS only)
- **SameSite**: Set to 'Strict' (CSRF protection)
- No sensitive data stored in cookies
- Session ID is cryptographically signed using HMAC-SHA256

### 3. Authorization
- Authentication middleware (`requireAuth`) protects write operations
- **Protected routes**:
  - POST `/api/movies` (Create)
  - PUT `/api/movies/:id` (Update)
  - DELETE `/api/movies/:id` (Delete)
- **Public routes**:
  - GET `/api/movies` (Read all)
  - GET `/api/movies/:id` (Read one)
- Unauthorized users see "Authentication Required" message
- Protected operations return 401 Unauthorized when not logged in

### 4. Validation & Error Handling
- Input validation for all endpoints
- Movie data validation:
  - Title: Required, non-empty string
  - Year: Required, valid year (1888 - 2030)
  - Genre: Array of strings
  - Rating: Optional, 0-10 range
- User data validation:
  - Username: Minimum 3 characters
  - Password: Minimum 6 characters
  - Email: Valid email format
- Proper HTTP status codes:
  - 200: Success
  - 201: Created
  - 400: Bad Request (validation errors)
  - 401: Unauthorized
  - 404: Not Found
  - 500: Internal Server Error
- Safe error handling - application never crashes

### 5. Web UI with Full CRUD
- **Create**: Add movie form (protected)
- **Read**: Movie list table with search
- **Update**: Edit modal for updating movies (protected)
- **Delete**: Delete button with confirmation (protected)
- Authentication UI: Login/Register/Logout buttons
- Real-time UI updates based on auth status
- No Postman needed - all operations via Web UI

## API Endpoints

### Authentication Endpoints
```
POST   /api/auth/register   - Register new user
POST   /api/auth/login      - Login user
POST   /api/auth/logout     - Logout user
GET    /api/auth/me         - Get current user info
```

### Movie Endpoints
```
Public:
GET    /api/movies          - Get all movies (supports filtering)
GET    /api/movies/:id      - Get movie by ID

Protected (requires login):
POST   /api/movies          - Create new movie
PUT    /api/movies/:id      - Update movie
DELETE /api/movies/:id      - Delete movie
```

### Query Parameters for GET /api/movies
```
?genre=Action               - Filter by genre
?year=2008                  - Filter by year
?director=Nolan             - Filter by director
?title=Dark                 - Search by title
?year_min=2000             - Minimum year
?year_max=2020             - Maximum year
?sortBy=year&order=desc     - Sort results
?fields=title,year          - Select specific fields
```

## How to Use

### 1. Start the Server
```bash
node server.js
```

### 2. Register a New User
1. Navigate to http://localhost:3000
2. Click "Register" in the top navigation
3. Fill in username (min 3 chars), optional email, password (min 6 chars)
4. Click "Register"
5. You'll be automatically logged in and redirected to home

### 3. Login
1. Click "Login" in navigation
2. Enter your username and password
3. Click "Login"
4. Redirected to home page

### 4. Add a Movie (Requires Login)
1. Ensure you're logged in
2. Fill in the "Add New Movie" form
3. Click "Add Movie"
4. Movie appears in the table below

### 5. Edit a Movie (Requires Login)
1. Click "Edit" button on any movie in the table
2. Modify the fields in the modal
3. Click "Save Changes"

### 6. Delete a Movie (Requires Login)
1. Click "Delete" button on any movie
2. Confirm the deletion
3. Movie is removed from the database

### 7. Search Movies (Public)
- Type in the search box to filter movies by title, director, or genre
- Search works in real-time

### 8. Logout
- Click "Logout" button in the navigation
- Session is destroyed
- Protected features become unavailable

## Security Implementation Details

### Session Management
- Custom session implementation using signed cookies
- Session ID: 32-byte random hex (256 bits)
- Signature: HMAC-SHA256 with secret key
- Cookie format: `sessionId.signature`
- Sessions stored in memory (use MongoDB/Redis in production)
- Automatic cleanup of expired sessions every hour

### Password Hashing
```javascript
// Hash: PBKDF2-SHA512 with 10,000 iterations
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512');
// Stored format: "salt:hash"
```

### Authentication Middleware
```javascript
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next(); // Authenticated
  }
  
  // Return 401 for API, redirect for pages
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.redirect('/login');
}
```

## Database Structure

### Users Collection
```javascript
{
  _id: ObjectId,
  username: String,        // Unique, min 3 chars
  password: String,        // Hashed: "salt:hash"
  email: String,           // Optional, validated
  createdAt: Date,
  updatedAt: Date
}
```

### Movies Collection (File-based currently)
```javascript
{
  _id: String,            // Generated ID
  title: String,          // Required
  year: Number,           // Required
  director: String,
  genre: Array<String>,
  rating: Number,         // 0-10
  age_rating: String,     // 0+, 6+, 12+, etc.
  description: String,
  createdBy: String,      // Username
  updatedBy: String,      // Username
  createdAt: String,      // ISO date
  updatedAt: String       // ISO date
}
```

## Environment Variables

Create a `.env` file:
```
MONGODB_URI=mongodb://localhost:27017
PORT=3000
SESSION_SECRET=change-this-in-production-to-a-long-random-string
NODE_ENV=development
```

For production, set:
```
NODE_ENV=production
SESSION_SECRET=<strong-random-secret>
```

## Assignment Requirements Checklist

**1. Project Base**
- Node.js + Express backend from Assignment 3
- MongoDB database configured
- All existing CRUD functionality preserved
- Deployed with public URL (ready for deployment)

**2. Domain Data**
- Domain-specific entity: Movies (not generic "items")
- 8 meaningful fields: title, year, director, genre, rating, age_rating, description, timestamps
- Database contains 20+ movie records
- Realistic and logically structured data

**3. Production Web Interface**
- All CRUD operations via Web UI
- Movies displayed in table format
- CREATE: Form to add movies
- READ: Table display with search
- UPDATE: Edit modal
- DELETE: Delete button with confirmation
- Data loaded dynamically from API
- No Postman needed for demonstration

**4. Sessions-based Authentication**
- Login via Web UI (/login)
- Server creates session after successful login
- Session ID stored in secure cookie
- Session persists between requests
- Custom session implementation with signed cookies

**5. Authentication & Authorization**
- Authentication middleware (`requireAuth`)
- Write operations (POST, PUT, DELETE) protected
- Unauthorized users cannot modify data
- Returns 401 for API requests
- Redirects to login for web pages

**6. Cookie Security**
- HttpOnly flag: Required (prevents XSS)
- Secure flag: Enabled in production (HTTPS only)
- SameSite: Strict (CSRF protection)
- No sensitive data in cookies (only signed session ID)

**7. Password Handling**
- Passwords hashed using crypto (PBKDF2-SHA512)
- 10,000 iterations with unique salt per password
- No plain-text storage
- Generic error messages ("Invalid credentials")
- Password verification using constant-time comparison

**8. Validation & Error Handling**
- Input validation for all endpoints
- Correct HTTP status codes (200, 201, 400, 401, 404, 500)
- Safe error handling - no crashes
- Validation errors return descriptive messages
- Try-catch blocks on all async operations

## Testing the Application

### Test Authentication Flow
1. Try to add a movie without logging in → See "Authentication Required"
2. Try API endpoint: `POST /api/movies` → Get 401 Unauthorized
3. Register new account → Success, automatically logged in
4. Try to add a movie → Success
5. Logout → Can't add movies anymore
6. Login again → Can add movies

### Test Security Features
1. Inspect cookies in browser DevTools → See HttpOnly flag
2. Try to access cookie via JavaScript console → Blocked
3. Check cookie value → Only see signed session ID (no password or sensitive data)
4. Check database → Passwords are hashed, not plain text

### Test Error Handling
1. Try to add movie with missing title → 400 Bad Request
2. Try to add movie with invalid year → 400 Bad Request
3. Try to edit non-existent movie → 404 Not Found
4. Try invalid login credentials → 401 Unauthorized with generic message

## Production Deployment Notes

Before deploying to production:

1. **Set environment variables**:
   ```
   NODE_ENV=production
   SESSION_SECRET=<generate-strong-random-secret>
   MONGODB_URI=<production-mongodb-url>
   ```

2. **Use persistent session store**:
   - Replace MemorySessionStore with MongoDB or Redis
   - Install connect-mongo: `npm install connect-mongo`
   - Sessions will survive server restarts

3. **Enable HTTPS**:
   - Secure flag on cookies requires HTTPS
   - Use reverse proxy (nginx) or hosting platform SSL

4. **Rate limiting**:
   - Add rate limiting to prevent brute force attacks
   - Recommended: express-rate-limit

5. **Logging**:
   - Add proper logging (Winston, Morgan)
   - Log authentication attempts
   - Monitor for suspicious activity

## Technologies Used

- **Backend**: Node.js, Express.js
- **Database**: MongoDB (with JSON file fallback)
- **Authentication**: Custom session implementation with signed cookies
- **Password Hashing**: Node.js crypto (PBKDF2-SHA512)
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Icons**: Font Awesome

## Author
Albek Gusmanov

## Group
SE-2425

## Version
4.0 - Authentication & Security Update

## License
MIT
