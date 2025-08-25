const jwt = require('jsonwebtoken');

// Share the same memory store with api-posts-db.js
const memoryStore = global.blogPostsMemoryStore || (global.blogPostsMemoryStore = new Map());

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
    // Try to use Netlify Blobs if available, otherwise use memory storage
    let store;
    let usingBlobs = false;
    
    try {
      // Try to import Netlify Blobs
      const { getStore } = require('@netlify/blobs');
      store = getStore('blog-posts');
      usingBlobs = true;
      console.log('Using Netlify Blobs for storage');
    } catch (blobError) {
      console.log('Netlify Blobs not available, using in-memory storage');
      // Blobs not available, use memory storage
      store = {
        get: async (key) => memoryStore.get(key),
        set: async (key, value) => memoryStore.set(key, JSON.parse(value)),
        delete: async (key) => memoryStore.delete(key)
      };
    }

    // Extract slug from path or query parameters
    let slug = '';
    
    // First check query parameters (for client-side requests)
    if (event.queryStringParameters && event.queryStringParameters.slug) {
      slug = event.queryStringParameters.slug;
    } 
    // Then check path parameters (for Netlify routing)
    else if (event.pathParameters && event.pathParameters.slug) {
      slug = event.pathParameters.slug;
    } 
    // Finally try to extract from path
    else {
      const pathParts = event.path.split('/');
      slug = pathParts[pathParts.length - 1];
    }
    
    slug = slug.split('?')[0]; // Remove any remaining query parameters
    
    console.log('Looking for post with slug:', slug);

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

    // GET /api/posts-slug-db/:slug - Get specific post
    if (event.httpMethod === 'GET') {
      
      try {
        // Try to get the post from storage
        const postData = usingBlobs 
          ? await store.get(slug, { type: 'json' })
          : memoryStore.get(slug);
        
        if (postData) {
          console.log('Found post in storage:', postData.title);
          
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
                  api_url: `${process.env.URL}/.netlify/functions/api-posts-slug-db/${slug}`,
                  web_url: `${process.env.URL}/posts/${slug}`,
                  edit_url: `${process.env.URL}/admin?edit=${slug}`,
                  storage_type: usingBlobs ? 'netlify_blobs_persistent' : 'in_memory_temporary'
                }
              }
            })
          };
        }
        
      } catch (storageError) {
        console.log('Post not found in storage:', storageError.message);
      }
      
      // If post not found in storage, return 404
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: 'not_found',
          message: `Post '${slug}' not found in our database`,
          suggestion: 'Check the URL or browse available posts from the home page'
        })
      };
    }

    // PUT /api/posts-slug-db/:slug - Update post (authenticated)
    if (event.httpMethod === 'PUT') {
      const decoded = verifyToken(event.headers.authorization);
      const { title, content, description, tags, isDraft } = JSON.parse(event.body);
      
      const existingPost = usingBlobs 
        ? await store.get(slug, { type: 'json' })
        : memoryStore.get(slug);
      
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

      if (usingBlobs) {
        await store.set(slug, JSON.stringify(updatedPost));
        console.log('Post updated in Netlify Blobs:', slug);
      } else {
        memoryStore.set(slug, updatedPost);
        console.log('Post updated in memory:', slug);
      }

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

    // DELETE /api/posts-slug-db/:slug - Delete post (authenticated)
    if (event.httpMethod === 'DELETE') {
      const decoded = verifyToken(event.headers.authorization);
      
      const existingPost = usingBlobs 
        ? await store.get(slug, { type: 'json' })
        : memoryStore.get(slug);
      
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

      if (usingBlobs) {
        await store.delete(slug);
        console.log('Post deleted from Netlify Blobs:', slug);
      } else {
        memoryStore.delete(slug);
        console.log('Post deleted from memory:', slug);
      }

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
