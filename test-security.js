const http = require('http');

const BASE_URL = 'http://localhost:3000';
let testResults = [];
let sessionCookie = null;

function makeRequest(method, path, data = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (cookie) {
      options.headers['Cookie'] = cookie;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : {};
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: jsonBody
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

function logTest(name, passed, details = '') {
  const symbol = passed ? '+' : '-';
  console.log(`${symbol} ${name}`);
  if (details) {
    console.log(`   ${details}`);
  }
  testResults.push({ name, passed, details });
}

async function runTests() {
  console.log('\nTesting Assignment 4 Requirements\n');
  console.log('='.repeat(60));

  try {
    const res = await makeRequest('GET', '/api/info');
    logTest('Server is running', res.statusCode === 200, 
      `Version: ${res.body.version || 'N/A'}`);
  } catch (error) {
    logTest('Server is running', false, 'Server not responding');
    return;
  }

  console.log('\nTesting Public Access');
  console.log('-'.repeat(60));
  
  const getMovies = await makeRequest('GET', '/api/movies');
  logTest('GET /api/movies (public)', getMovies.statusCode === 200,
    `Found ${getMovies.body.count || 0} movies`);

  console.log('\nTesting Protected Routes (without auth)');
  console.log('-'.repeat(60));

  const postWithoutAuth = await makeRequest('POST', '/api/movies', {
    title: 'Test Movie',
    year: 2024
  });
  logTest('POST /api/movies without auth returns 401', 
    postWithoutAuth.statusCode === 401,
    `Status: ${postWithoutAuth.statusCode}`);

  const putWithoutAuth = await makeRequest('PUT', '/api/movies/test123', {
    title: 'Updated Movie',
    year: 2024
  });
  logTest('PUT /api/movies/:id without auth returns 401', 
    putWithoutAuth.statusCode === 401,
    `Status: ${putWithoutAuth.statusCode}`);

  const deleteWithoutAuth = await makeRequest('DELETE', '/api/movies/test123');
  logTest('DELETE /api/movies/:id without auth returns 401', 
    deleteWithoutAuth.statusCode === 401,
    `Status: ${deleteWithoutAuth.statusCode}`);

  console.log('\nTesting User Registration');
  console.log('-'.repeat(60));

  const testUsername = 'testuser_' + Date.now();
  const testPassword = 'securepass123';

  const registerRes = await makeRequest('POST', '/api/auth/register', {
    username: testUsername,
    password: testPassword,
    email: 'test@example.com'
  });

  const registrationSuccess = registerRes.statusCode === 201;
  logTest('User registration succeeds', registrationSuccess,
    registrationSuccess ? 'User created successfully' : `Error: ${registerRes.body.error}`);

  if (registrationSuccess && registerRes.headers['set-cookie']) {
    sessionCookie = registerRes.headers['set-cookie'][0].split(';')[0];
    logTest('Session cookie set after registration', true,
      'Cookie: ' + sessionCookie.substring(0, 30) + '...');
  } else {
    logTest('Session cookie set after registration', false);
  }

  console.log('\nTesting Password Security');
  console.log('-'.repeat(60));

  const weakPassRes = await makeRequest('POST', '/api/auth/register', {
    username: 'testuser2_' + Date.now(),
    password: '123'
  });
  logTest('Short password rejected', weakPassRes.statusCode === 400,
    `Status: ${weakPassRes.statusCode}`);

  const wrongPassRes = await makeRequest('POST', '/api/auth/login', {
    username: testUsername,
    password: 'wrongpassword'
  });
  logTest('Wrong password returns 401', wrongPassRes.statusCode === 401,
    `Message: ${wrongPassRes.body.error}`);
  
  logTest('Generic error message used', 
    wrongPassRes.body.error === 'Invalid credentials',
    'Does not reveal whether username or password is wrong');

  console.log('\nTesting Login');
  console.log('-'.repeat(60));

  const loginRes = await makeRequest('POST', '/api/auth/login', {
    username: testUsername,
    password: testPassword
  });

  const loginSuccess = loginRes.statusCode === 200;
  logTest('Login succeeds with correct credentials', loginSuccess,
    loginSuccess ? 'Login successful' : `Error: ${loginRes.body.error}`);

  if (loginSuccess && loginRes.headers['set-cookie']) {
    sessionCookie = loginRes.headers['set-cookie'][0].split(';')[0];
    logTest('Session cookie set after login', true);
  }

  console.log('\nTesting Cookie Security');
  console.log('-'.repeat(60));

  if (loginRes.headers['set-cookie']) {
    const cookieHeader = loginRes.headers['set-cookie'][0];
    
    logTest('HttpOnly flag present', cookieHeader.includes('HttpOnly'),
      'Prevents JavaScript access to cookie');
    
    logTest('SameSite flag present', cookieHeader.includes('SameSite'),
      'Protects against CSRF attacks');
    
    logTest('Cookie has Max-Age', cookieHeader.includes('Max-Age'),
      'Session has expiration time');

    const hasSecure = cookieHeader.includes('Secure');
    logTest('Secure flag (production only)', hasSecure,
      hasSecure ? 'HTTPS only' : 'Should be enabled in production');
  } else {
    logTest('Cookie security flags', false, 'No cookie set');
  }

  console.log('\nTesting Authenticated Operations');
  console.log('-'.repeat(60));

  if (sessionCookie) {
    const createRes = await makeRequest('POST', '/api/movies', {
      title: 'Test Movie ' + Date.now(),
      year: 2024,
      director: 'Test Director',
      genre: ['Action', 'Sci-Fi'],
      rating: 8.5,
      age_rating: '12+',
      description: 'A test movie for security testing'
    }, sessionCookie);

    const createSuccess = createRes.statusCode === 201;
    logTest('Create movie with valid session', createSuccess,
      createSuccess ? `Created: ${createRes.body.title}` : `Error: ${createRes.body.error}`);

    if (createSuccess) {
      const movieId = createRes.body._id;

      const updateRes = await makeRequest('PUT', `/api/movies/${movieId}`, {
        title: 'Updated Test Movie',
        year: 2024
      }, sessionCookie);

      logTest('Update movie with valid session', updateRes.statusCode === 200,
        `Status: ${updateRes.statusCode}`);

      const deleteRes = await makeRequest('DELETE', `/api/movies/${movieId}`, 
        null, sessionCookie);

      logTest('Delete movie with valid session', deleteRes.statusCode === 200,
        `Status: ${deleteRes.statusCode}`);
    }
  } else {
    logTest('Authenticated operations', false, 'No session cookie available');
  }

  console.log('\nTesting Input Validation');
  console.log('-'.repeat(60));

  if (sessionCookie) {
    const missingTitle = await makeRequest('POST', '/api/movies', {
      year: 2024
    }, sessionCookie);
    logTest('Missing title rejected', missingTitle.statusCode === 400,
      `Status: ${missingTitle.statusCode}`);

    const invalidYear = await makeRequest('POST', '/api/movies', {
      title: 'Test',
      year: 1800
    }, sessionCookie);
    logTest('Invalid year rejected', invalidYear.statusCode === 400,
      `Status: ${invalidYear.statusCode}`);
  }

  console.log('\nTesting Session Persistence');
  console.log('-'.repeat(60));

  if (sessionCookie) {
    const meRes = await makeRequest('GET', '/api/auth/me', null, sessionCookie);
    logTest('Session persists across requests', meRes.statusCode === 200,
      meRes.body.user ? `User: ${meRes.body.user.username}` : 'No user data');
  }

  console.log('\nTesting Logout');
  console.log('-'.repeat(60));

  if (sessionCookie) {
    const logoutRes = await makeRequest('POST', '/api/auth/logout', null, sessionCookie);
    logTest('Logout succeeds', logoutRes.statusCode === 200,
      `Message: ${logoutRes.body.message}`);

    const afterLogout = await makeRequest('POST', '/api/movies', {
      title: 'Should Fail',
      year: 2024
    }, sessionCookie);
    logTest('Protected resources inaccessible after logout', 
      afterLogout.statusCode === 401,
      `Status: ${afterLogout.statusCode}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));

  const passed = testResults.filter(t => t.passed).length;
  const total = testResults.length;
  const percentage = ((passed / total) * 100).toFixed(1);

  console.log(`\nPassed: ${passed}/${total} (${percentage}%)`);
  
  if (passed === total) {
    console.log('\nAll tests passed.');
  } else {
    console.log('\nSome tests failed. Please review the results above.');
  }

  console.log('\n' + '='.repeat(60));
}

runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
