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
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    if (!process.env.JWT_SECRET) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    const { instance, username, password } = JSON.parse(event.body);

    if (!instance || !username || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
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

      // Create our own blog session token (NOT storing Lemmy JWT)
      const sessionToken = jwt.sign(
        {
          username: username,
          instance: instance,
          lemmyUserId: userResponse.person_view.person.id,
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
          user: { 
            username, 
            instance,
            displayName: userResponse.person_view.person.display_name || username,
            bio: userResponse.person_view.person.bio,
            avatar: userResponse.person_view.person.avatar,
            postCount: userResponse.person_view.counts.post_count,
            commentCount: userResponse.person_view.counts.comment_count
          }
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
