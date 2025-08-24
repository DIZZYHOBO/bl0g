const jwt = require('jsonwebtoken');

function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Invalid authorization header');
  }
  
  const token = authHeader.substring(7);
  return jwt.verify(token, process.env.JWT_SECRET);
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ 
        error: 'method_not_allowed',
        message: 'Only GET method is supported' 
      })
    };
  }

  try {
    const decoded = verifyToken(event.headers.authorization);
    
    // In a real app, you'd fetch updated user data from your database
    // For now, return the token data
    const userProfile = {
      username: decoded.username,
      instance: decoded.instance,
      lemmy_user_id: decoded.lemmyUserId,
      token_expires: decoded.exp,
      authenticated_since: decoded.iat
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          user: userProfile,
          permissions: ['read_posts', 'write_posts', 'delete_own_posts'],
          session_info: {
            expires_at: new Date(decoded.exp * 1000).toISOString(),
            time_remaining: decoded.exp - Math.floor(Date.now() / 1000)
          }
        }
      })
    };

  } catch (error) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({
        error: 'unauthorized',
        message: 'Invalid or expired token'
      })
    };
  }
};
