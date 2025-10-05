const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Create an axios instance that doesn't reject unauthorized certificates
// WARNING: Only use this for testing, not in production
const agent = new https.Agent({  
  rejectUnauthorized: false
});

const API_BASE_URL = 'https://exponentialpotential.space/api/v1';

// Test configuration
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'testpassword123';

// Helper function to make API requests
async function makeRequest(method, endpoint, data = null, headers = {}) {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log(`\n${method.toUpperCase()} ${url}`);
    
    const config = {
      method,
      url,
      httpsAgent: agent,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      withCredentials: true, // Important for cookies
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    console.log(`✅ Success (${response.status}):`, response.data);
    return response;
  } catch (error) {
    if (error.response) {
      console.error(`❌ Error (${error.response.status}):`, {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers,
      });
    } else if (error.request) {
      console.error('❌ No response received:', error.request);
    } else {
      console.error('❌ Request setup error:', error.message);
    }
    throw error;
  }
}

// Test cases
async function runTests() {
  console.log('🚀 Starting API tests...');
  
  try {
    // Test 1: Health check
    console.log('\n--- Test 1: Health Check ---');
    await makeRequest('get', '/health/');
    
    // Test 2: Get CSRF token
    console.log('\n--- Test 2: Get CSRF Token ---');
    const csrfResponse = await makeRequest('get', '/auth/csrf/');
    const csrfToken = csrfResponse.data.csrfToken;
    
    // Test 3: User registration
    console.log('\n--- Test 3: User Registration ---');
    await makeRequest('post', '/auth/register/', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      first_name: 'Test',
      last_name: 'User'
    }, {
      'X-CSRFToken': csrfToken
    });
    
    // Test 4: User login
    console.log('\n--- Test 4: User Login ---');
    const loginResponse = await makeRequest('post', '/auth/login/', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    }, {
      'X-CSRFToken': csrfToken
    });
    
    const accessToken = loginResponse.data.access;
    
    // Test 5: Get user profile (protected route)
    console.log('\n--- Test 5: Get User Profile ---');
    await makeRequest('get', '/auth/user/', null, {
      'Authorization': `Bearer ${accessToken}`,
      'X-CSRFToken': csrfToken
    });
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Tests failed:', error.message);
    process.exit(1);
  }
}

// Run the tests
runTests();
