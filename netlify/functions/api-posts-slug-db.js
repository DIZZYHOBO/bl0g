const jwt = require('jsonwebtoken');

// Share memory store with main posts function
const memoryStore = global.postsMemoryStore || (global.postsMemoryStore = new Map());

// Ensure welcome post exists
if (memoryStore.size === 0) {
  memoryStore.set('welcome-to-blog', {
    slug: 'welcome-to-blog',
    title: 'Welcome to Your Blog! 🚀',
    description: 'Start sharing your thoughts and ideas',
    content: `# Welcome to Your Blog! 🚀

This is your blog platform where you can share your thoughts, tutorials, and insights with the world.

## Getting Started

To contribute:
1. Login with your Lemmy account
2. Click "New Post" to create content
3. Share your expertise with readers

Happy blogging!`,
    content_preview: 'Welcome to your blog! Start sharing your thoughts and ideas with the world...',
    author: 'Admin',
    date: new Date().toISOString().split('T')[0],
    tags: ['welcome', 'getting-started'],
    read_time: 1,
    word_count: 80,
    published: true,
    draft: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    featured: true
  });
}

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
    // Use in-memory storage
    const storage = {
      get: async (key) => memoryStore.get(key) || null,
      setJSON: async (key, value) => memoryStore.set(key, value),
      delete: async (key) => memoryStore.delete(key)
    };
    
    // Extract slug
    const slug = event.queryStringParameters?.slug;
    
    if (!slug) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'bad_request',
          message: 'Post slug is required: ?slug=post-slug'
        })
      };
    }

    console.log('Processing request for slug:', slug);

    // GET - Get specific post
    if (event.httpMethod === 'GET') {
      const postData = await storage.get(slug);
      
      if (!postData) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            error: 'not_found',
            message: `Post '${slug}' not found`
          })
        };
      }
      
      // Check if draft
      if (postData.draft) {
        try {
          const decoded = verifyToken(event.headers.authorization);
          if (postData.author !== `${decoded.username}@${decoded.instance}`) {
            return {
              statusCode: 404,
              headers,
              body: JSON.stringify({
                error: 'not_found',
                message: 'Post not found'
              })
            };
          }
        } catch {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({
              error: 'not_found',
              message: 'Post not found'
            })
          };
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            post: postData
          }
        })
      };
    }

    // PUT - Update post
    if (event.httpMethod === 'PUT') {
      const decoded = verifyToken(event.headers.authorization);
      const updates = JSON.parse(event.body);
      
      const existingPost = await storage.get(slug);
      
      if (!existingPost) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            error: 'not_found',
            message: 'Post not found'
          })
        };
      }

      if (existingPost.author !== `${decoded.username}@${decoded.instance}`) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({
            error: 'forbidden',
            message: 'You can only edit your own posts'
          })
        };
      }

      const updatedPost = {
        ...existingPost,
        ...updates,
        updated_at: new Date().toISOString()
      };

      await storage.setJSON(slug, updatedPost);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Post updated successfully'
        })
      };
    }

    // DELETE - Delete post
    if (event.httpMethod === 'DELETE') {
      const decoded = verifyToken(event.headers.authorization);
      
      const existingPost = await storage.get(slug);
      
      if (!existingPost) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            error: 'not_found',
            message: 'Post not found'
          })
        };
      }

      if (existingPost.author !== `${decoded.username}@${decoded.instance}`) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({
            error: 'forbidden',
            message: 'You can only delete your own posts'
          })
        };
      }

      await storage.delete(slug);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Post deleted successfully'
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
    console.error('API Error:', error);
    
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
        message: error.message
      })
    };
  }
};
