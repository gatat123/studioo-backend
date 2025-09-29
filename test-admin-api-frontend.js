/**
 * Test script for admin API calls from frontend-fix
 * This script will test the admin API authentication flow
 */

const API_BASE_URL = 'http://localhost:3001';

// Mock authentication token for gatat123 user
// In a real scenario, this would be obtained from login
async function testAdminAPI() {
  console.log('Testing Admin API calls to:', API_BASE_URL);

  // Test endpoints that were failing
  const testEndpoints = [
    '/api/admin/stats',
    '/api/admin/system/status',
    '/api/admin/projects/stats',
    '/api/admin/users'
  ];

  // Test without authentication first
  console.log('\n=== Testing without authentication ===');
  for (const endpoint of testEndpoints) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      console.log(`${endpoint}: ${response.status} ${response.statusText}`);
      if (response.status === 401) {
        console.log('  ✓ Correctly returning 401 for unauthorized request');
      }
    } catch (error) {
      console.log(`${endpoint}: ERROR - ${error.message}`);
    }
  }

  // Test with mock token (this would need a real token from login)
  console.log('\n=== Testing with mock Bearer token ===');
  const mockToken = 'mock-jwt-token';

  for (const endpoint of testEndpoints) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${mockToken}`,
          'Content-Type': 'application/json'
        }
      });
      console.log(`${endpoint}: ${response.status} ${response.statusText}`);

      if (response.status === 401) {
        const errorData = await response.text();
        console.log('  Response:', errorData);
      }
    } catch (error) {
      console.log(`${endpoint}: ERROR - ${error.message}`);
    }
  }

  // Test basic connectivity
  console.log('\n=== Testing basic connectivity ===');
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    console.log(`Health check: ${response.status} ${response.statusText}`);
  } catch (error) {
    console.log(`Health check failed: ${error.message}`);
  }
}

// Run the test
testAdminAPI().catch(console.error);