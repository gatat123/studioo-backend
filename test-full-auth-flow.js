/**
 * Complete authentication flow test for admin functionality
 */

const API_BASE_URL = 'http://localhost:3003';

async function testAuthFlow() {
  console.log('=== Complete Authentication Flow Test ===\n');

  // Step 1: Test user registration (if needed)
  console.log('1. Testing user registration...');
  const registerData = {
    username: 'gatat123',
    email: 'gatat123@example.com',
    password: 'password123',
    nickname: 'Admin User'
  };

  try {
    const registerResponse = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(registerData)
    });

    if (registerResponse.ok) {
      const registerResult = await registerResponse.json();
      console.log('   ✓ Registration successful');
      console.log('   Token:', registerResult.accessToken?.substring(0, 20) + '...');
    } else if (registerResponse.status === 400) {
      console.log('   ℹ User might already exist, trying login...');
    } else {
      console.log('   ✗ Registration failed:', registerResponse.status);
    }
  } catch (error) {
    console.log('   ✗ Registration error:', error.message);
  }

  // Step 2: Test user login
  console.log('\n2. Testing user login...');
  const loginData = {
    username: 'gatat123',
    password: 'password123'
  };

  try {
    const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginData)
    });

    if (loginResponse.ok) {
      const loginResult = await loginResponse.json();
      console.log('   ✓ Login successful');
      console.log('   User:', loginResult.user?.username);
      console.log('   Is Admin:', loginResult.user?.isAdmin || loginResult.user?.is_admin);

      const accessToken = loginResult.accessToken || loginResult.token;
      if (accessToken) {
        console.log('   Token (first 20 chars):', accessToken.substring(0, 20) + '...');

        // Step 3: Test admin API calls with token
        await testAdminAPIs(accessToken);
      } else {
        console.log('   ✗ No access token received');
      }
    } else {
      const errorData = await loginResponse.text();
      console.log('   ✗ Login failed:', loginResponse.status, errorData);
    }
  } catch (error) {
    console.log('   ✗ Login error:', error.message);
  }
}

async function testAdminAPIs(token) {
  console.log('\n3. Testing Admin API calls with authentication...');

  const adminEndpoints = [
    '/api/admin/stats',
    '/api/admin/users',
    '/api/admin/projects'
  ];

  for (const endpoint of adminEndpoints) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`   ${endpoint}:`, response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('     ✓ Data received:', typeof data === 'object' ? Object.keys(data) : data);
      } else {
        const errorText = await response.text();
        console.log('     ✗ Error response:', errorText);
      }
    } catch (error) {
      console.log(`   ${endpoint}: ERROR -`, error.message);
    }
  }

  // Step 4: Test session endpoint
  console.log('\n4. Testing session endpoint...');
  try {
    const sessionResponse = await fetch(`${API_BASE_URL}/api/auth/session`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('   Session API:', sessionResponse.status, sessionResponse.statusText);
    if (sessionResponse.ok) {
      const sessionData = await sessionResponse.json();
      console.log('   User from session:', sessionData.user?.username);
      console.log('   Admin status:', sessionData.user?.isAdmin || sessionData.user?.is_admin);
    }
  } catch (error) {
    console.log('   Session test error:', error.message);
  }
}

// Run the complete test
testAuthFlow().catch(console.error);