const jwt = require('jsonwebtoken');

// In-memory storage as fallback
if (!global.blogPostsMemoryStore) {
  global.blogPostsMemoryStore = new Map();
}
const memoryStore = global.blogPostsMemoryStore;

// Try to load Netlify Blobs if available
let getStore;
try {
  const blobsModule = require('@netlify/blobs');
  getStore = blobsModule.getStore;
  console.log('Netlify Blobs module loaded successfully');
} catch (error) {
  console.log('Netlify Blobs not available, using memory storage');
  getStore = null;
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
    // Initialize storage
    let store;
    let usingBlobs = false;
    
    // Try to use Netlify Blobs if available
    if (getStore && context.site) {
      try {
        store = getStore({
          name: 'blog-posts',
          siteID: context.site.id,
        });
        usingBlobs = true;
        console.log('Using Netlify Blobs for storage');
      } catch (blobError) {
        console.log('Failed to initialize Netlify Blobs:', blobError.message);
        store = null;
        usingBlobs = false;
      }
    }
    
    // Create wrapper for consistent API
    const storage = usingBlobs ? {
      get: async (key) => {
        try {
          return await store.get(key);
        } catch (e) {
          if (e.message?.includes('404')) return null;
          throw e;
        }
      },
      set: async (key, value) => store.set(key, value),
      delete: async (key) => store.delete(key)
    } : {
      get: async (key) => memoryStore.get(key) || null,
      set: async (key, value) => memoryStore.set(key, value),
      delete: async (key) => memoryStore.delete(key)
    };

    // Extract slug from query parameters
    let slug = '';
    
    if (event.queryStringParameters && event.queryStringParameters.slug) {
      slug = event.queryStringParameters.slug;
    } 
    else if (event.pathParameters && event.pathParameters.slug) {
      slug = event.pathParameters.slug;
    } 
    else {
      const pathParts = event.path.split('/');
      slug = pathParts[pathParts.length - 1];
    }
    
    slug = slug.split('?')[0];
    
    console.log('Looking for post with slug:', slug);

    if (!slug || slug === 'api-posts-slug-db') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'bad_request',
          message: 'Post slug is required as query parameter: ?slug=your-post-slug'
        })
      };
    }

    // GET - Get specific post
    if (event.httpMethod === 'GET') {
      try {
        // Get the post from storage
        const postData = await storage.get(slug);
        
        if (postData) {
          console.log('Found post:', postData.title);
          
          // Don't return drafts unless user is authenticated and is the author
          if (postData.draft) {
            try {
              const decoded = verifyToken(event.headers.authorization);
              if (postData.author !== `${decoded.username}@${decoded.instance}`) {
                throw new Error('Not the author');
              }
            } catch (authError) {
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
                post: postData,
                meta: {
                  api_url: `${process.env.URL}/.netlify/functions/api-posts-slug-db?slug=${slug}`,
                  web_url: `${process.env.URL}/posts/${slug}`,
                  edit_url: `${process.env.URL}/admin?edit=${slug}`,
                  storage_type: usingBlobs ? 'netlify_blobs_persistent' : 'in_memory_temporary'
                }
              }
            })
          };
        } else {
          // Post not found
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({
              error: 'not_found',
              message: `Post '${slug}' not found`,
              suggestion: 'Check the URL or browse available posts from the home page'
            })
          };
        }
        
      } catch (storageError) {
        console.log('Error fetching post:', storageError);
        
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            error: 'not_found',
            message: `Post '${slug}' not found`,
            details: storageError.message
          })
        };
      }
    }

    // PUT - Update post (authenticated)
    if (event.httpMethod === 'PUT') {
      const decoded = verifyToken(event.headers.authorization);
      const { title, content, description, tags, isDraft } = JSON.parse(event.body);
      
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

      // Check if user is the author
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

      // Update post data
      const updatedPost = {
        ...existingPost,
        title: title || existingPost.title,
        content: content || existingPost.content,
        description: description !== undefined ? description : existingPost.description,
        tags: tags !== undefined ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean)) : existingPost.tags,
        draft: isDraft !== undefined ? isDraft : existingPost.draft,
        published: isDraft !== undefined ? !isDraft : existingPost.published,
        updated_at: new Date().toISOString(),
      };

      // Recalculate derived fields if content changed
      if (content && content !== existingPost.content) {
        const wordCount = content.split(/\s+/).length;
        updatedPost.word_count = wordCount;
        updatedPost.read_time = Math.ceil(wordCount / 200);
        updatedPost.content_preview = content.substring(0, 200) + (content.length > 200 ? '...' : '');
      }

      await storage.set(slug, updatedPost);
      console.log(`Post updated in ${usingBlobs ? 'Netlify Blobs' : 'memory'}:`, slug);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Post updated successfully',
          data: {
            slug: slug,
            title: updatedPost.title,
            updated_at: updatedPost.updated_at,
            storage_type: usingBlobs ? 'netlify_blobs_persistent' : 'in_memory_temporary'
          }
        })
      };
    }

    // DELETE - Delete post (authenticated)
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

      // Check if user is the author
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
      console.log(`Post deleted from ${usingBlobs ? 'Netlify Blobs' : 'memory'}:`, slug);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Post deleted successfully',
          data: {
            slug: slug,
            deleted_at: new Date().toISOString()
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
    console.error('Single post API error:', error);
    console.error('Error stack:', error.stack);
    
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
        message: 'Internal server error',
        details: error.message,
        type: error.name,
        storage_info: 'Check if @netlify/blobs is installed and Netlify Blobs is enabled for your site'
      })
    };
  }
};
