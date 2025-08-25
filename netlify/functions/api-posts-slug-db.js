const jwt = require('jsonwebtoken');
const { getStore } = require('@netlify/blobs');

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
    // Initialize Netlify Blobs store
    const store = getStore('blog-posts');
    
    // Extract slug from query parameters
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
      try {
        // Get post from Netlify Blobs
        const postData = await store.get(slug, { type: 'json' });
        
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
        
        // Check if draft (only author can see drafts)
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
        
      } catch (error) {
        console.error('Error fetching post:', error);
        
        // Handle Netlify Blobs not found error
        if (error.message?.includes('404') || error.message?.includes('not found')) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({
              error: 'not_found',
              message: `Post '${slug}' not found`
            })
          };
        }
        
        throw error;
      }
    }

    // PUT - Update post
    if (event.httpMethod === 'PUT') {
      const decoded = verifyToken(event.headers.authorization);
      const updates = JSON.parse(event.body);
      
      // Get existing post
      const existingPost = await store.get(slug, { type: 'json' });
      
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

      // Check ownership
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

      // Update post
      const updatedPost = {
        ...existingPost,
        ...updates,
        updated_at: new Date().toISOString()
      };

      await store.setJSON(slug, updatedPost);

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
      
      // Get existing post
      const existingPost = await store.get(slug, { type: 'json' });
      
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

      // Check ownership
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

      await store.delete(slug);

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
        message: error.message,
        tip: 'Make sure @netlify/blobs is installed: npm install @netlify/blobs'
      })
    };
  }
};
