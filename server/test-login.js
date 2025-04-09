// Simple script to test the login API endpoint
import fetch from 'node-fetch';

async function testLogin() {
  try {
    console.log('Testing login with superadmin/password123...');
    
    const response = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Test login with the specified credentials: superadmin/password123 
      body: JSON.stringify({
        username: 'superadmin',
        password: 'password123',
      }),
    });
    
    const data = await response.json();
    console.log('Response status:', response.status);
    
    if (response.ok) {
      console.log('Login successful!');
      console.log('User data:', JSON.stringify(data, null, 2));
    } else {
      console.log('Login failed:', data.message);
    }
  } catch (error) {
    console.error('Error testing login:', error);
  }
}

testLogin();