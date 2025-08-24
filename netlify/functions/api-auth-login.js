const jwt = require('jsonwebtoken');

exports.handler = async (event, context) => {
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
      body: JSON.stringify({ 
        error: 'Method not allowed',
        message: 'Only POST method is supported for login'
      })
    };
  }

  try {
    if (!process.env.JWT_SECRET) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'server_error',
          message: 'Server configuration error' 
        })
      };
    }

    const { instance, username, password } = JSON.parse(event.body);

    if (!instance || !username || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'validation_error',
          message: 'Missing required fields: instance, username, password',
          required_fields: ['instance', 'username', 'password']
        })
      };
    }

    // Import LemmyHttp dynamically
    const { LemmyHttp } = await import('lemmy-js-client');
    
    const client = new LemmyHttp(`https://${instance}`);
    
    // Verify credentials by logging in
    const loginResponse = await client.login({
      username_or_email: username,
      password: password,
    });

    if (loginResponse.jwt) {
      // Get user profile info
      const userResponse = await client.getPersonDetails({
        username: username,
        auth: loginResponse.jwt,
      });

      const person = userResponse.person_view.person;
      const counts = userResponse.person_view.counts;

      // Create blog session token
      const sessionToken = jwt.sign(
        {
          username: username,
          instance: instance,
          lemmyUserId: person.id,
          exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
        },
        process.env.JWT_SECRET
      );

      // Create refresh token (longer expiry)
      const refreshToken = jwt.sign(
        {
          username: username,
          instance: instance,
          type: 'refresh',
          exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
        },
        process.env.JWT_SECRET
      );

      const userProfile = {
        username,
        instance,
        display_name: person.display_name || username,
        bio: person.bio || '',
        avatar: person.avatar || null,
        banner: person.banner || null,
        cake_day: person.published,
        stats: {
          post_count: counts.post_count,
          comment_count: counts.comment_count,
          post_score: counts.post_score,
          comment_score: counts.comment_score
        },
        profile_url: `https://${instance}/u/${username}`
      };

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          message: 'Login successful',
          data: {
            access_token: sessionToken,
            refresh_token: refreshToken,
            token_type: 'Bearer',
            expires_in: 86400, // 24 hours in seconds
            user: userProfile
          }
        })
      };
    } else {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          error: 'authentication_failed',
          message: 'Invalid credentials provided'
        })
      };
    }
  } catch (error) {
    console.error('Auth API error:', error);
    
    if (error.message.includes('fetch')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'instance_unreachable',
          message: 'Could not connect to the specified Lemmy instance',
          details: `Failed to reach https://${JSON.parse(event.body)?.instance || 'unknown'}`
        })
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'authentication_error',
        message: 'Authentication failed',
        details: error.message
      })
    };
  }
};
