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
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Extract slug from path
    const pathParts = event.path.split('/');
    const slug = pathParts[pathParts.length - 1];

    if (!slug) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'bad_request',
          message: 'Post slug is required'
        })
      };
    }

    // GET /api/posts/:slug - Get specific post
    if (event.httpMethod === 'GET') {
      // Mock post data - in real app, you'd load from files/database
      const mockPost = {
        slug: slug,
        title: 'My Blog Post',
        description: 'This is a sample blog post',
        content: '# Welcome\n\nThis is the full content of the blog post...',
        author: 'user@lemmy.ml',
        date: '2025-01-15',
        tags: ['sample', 'api'],
        published: true,
        created_at: '2025-01-15T10:00:00Z',
        updated_at: '2025-01-15T10:00:00Z',
        stats: {
          word_count: 150,
          read_time: 3,
          character_count: 890
        }
      };

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            post: mockPost,
            meta: {
              api_url: `${process.env.URL}/.netlify/functions/api-posts-slug/${slug}`,
              web_url: `${process.env.URL}/posts/${slug}`,
              edit_url: `${process.env.URL}/admin?edit=${slug}`
            }
          }
        })
      };
    }

    // PUT /api/posts/:slug - Update post
    if (event.httpMethod === 'PUT') {
      const decoded = verifyToken(event.headers.authorization);
      const { title, content, description, tags, isDraft } = JSON.parse(event.body);
      
      // In real app, you'd update the actual file
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Post updated successfully',
          data: {
            slug: slug,
            title: title,
            updated_at: new Date().toISOString(),
            updated_by: `${decoded.username}@${decoded.instance}`
          }
        })
      };
    }

    // DELETE /api/posts/:slug - Delete post
    if (event.httpMethod === 'DELETE') {
      const decoded = verifyToken(event.headers.authorization);
      
      // In real app, you'd delete the actual file
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Post deleted successfully',
          data: {
            slug: slug,
            deleted_at: new Date().toISOString(),
            deleted_by: `${decoded.username}@${decoded.instance}`
          }
        })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        error: 'method_not_allowed',
        message: 'Method not supported'
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
