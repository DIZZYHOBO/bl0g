const jwt = require('jsonwebtoken');

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Check if JWT_SECRET exists
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET environment variable is not set');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid request body' })
      };
    }

    const { instance, username, password } = requestBody;

    if (!instance || !username || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: instance, username, password' })
      };
    }

    // Import LemmyHttp dynamically
    const { LemmyHttp } = await import('lemmy-js-client');
    
    console.log(`Attempting to login to ${instance} with username: ${username}`);
    
    const client = new LemmyHttp(`https://${instance}`);
    const loginResponse = await client.login({
      username_or_email: username,
      password: password,
    });

    console.log('Login response received:', !!loginResponse.jwt);

    if (loginResponse.jwt) {
      // Create our own session token
      const sessionToken = jwt.sign(
        {
          lemmyJwt: loginResponse.jwt,
          instance: instance,
          username: username,
          exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
        },
        process.env.JWT_SECRET
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          token: sessionToken,
          user: { username, instance }
        })
      };
    } else {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid credentials' })
      };
    }
  } catch (error) {
    console.error('Auth error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Authentication failed',
        details: error.message 
      })
    };
  }
};
