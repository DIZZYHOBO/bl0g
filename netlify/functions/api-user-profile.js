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
    
    // Mock user profile with blog stats
    const userProfile = {
      user_info: {
        username: decoded.username,
        instance: decoded.instance,
        display_name: decoded.username,
        profile_url: `https://${decoded.instance}/u/${decoded.username}`,
        joined_blog: new Date(decoded.iat * 1000).toISOString(),
        lemmy_user_id: decoded.lemmyUserId
      },
      blog_stats: {
        total_posts: 5,
        published_posts: 4,
        draft_posts: 1,
        total_words: 2500,
        total_views: 150,
        avg_read_time: 4.2,
        most_used_tags: ['javascript', 'tutorial', 'web development'],
        latest_post_date: '2025-01-15',
        first_post_date: '2025-01-01'
      },
      recent_activity: [
        {
          type: 'post_published',
          title: 'My Latest Tutorial',
          date: '2025-01-15T10:00:00Z',
          slug: 'my-latest-tutorial'
        },
        {
          type: 'post_updated',
          title: 'Updated Getting Started Guide',
          date: '2025-01-14T15:00:00Z',
          slug: 'getting-started-guide'
        },
        {
          type: 'draft_created',
          title: 'Work in Progress',
          date: '2025-01-13T09:00:00Z',
          slug: 'work-in-progress'
        }
      ],
      api_usage: {
        total_api_calls: 47,
        calls_today: 12,
        last_api_call: new Date().toISOString(),
        rate_limit_remaining: 88
      }
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: userProfile,
        meta: {
          generated_at: new Date().toISOString(),
          profile_url: `${process.env.URL}/api/user/profile`,
          posts_url: `${process.env.URL}/api/user/posts`,
          activity_url: `${process.env.URL}/api/user/activity`
        }
      })
    };

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          error: 'unauthorized',
          message: 'Invalid token'
        })
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'server_error',
        message: 'Internal server error'
      })
    };
  }
};
