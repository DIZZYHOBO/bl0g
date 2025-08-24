const jwt = require('jsonwebtoken');
const { getStore } = require('@netlify/blobs');
const { serialize } = require('next-mdx-remote/serialize');

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

    const store = getStore('blog-posts');

    // GET /api/posts/:slug - Get specific post
    if (event.httpMethod === 'GET') {
      console.log('Fetching post:', slug);
      
      const postData = await store.get(slug, { type: 'json' });
      
      if (!postData) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            error: 'not_found',
            message: 'Post not found'
          })
        };
      }

      // Don't return drafts unless user is authenticated and is the author
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
              edit_url: `${process.env.URL}/admin?edit=${slug}`
            }
          }
        })
      };
    }

    // PUT /api/posts/:slug - Update post (authenticated)
    if (event.httpMethod === 'PUT') {
      const decoded = verifyToken(event.headers.authorization);
      const { title, content, description, tags, isDraft } = JSON.parse(event.body);
      
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

      await store.set(slug, JSON.stringify(updatedPost));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Post updated successfully',
          data: {
            slug: slug,
            title: updatedPost.title,
            updated_at: updatedPost.updated_at
          }
        })
      };
    }

    // DELETE /api/posts/:slug - Delete post (authenticated)
    if (event.httpMethod === 'DELETE') {
      const decoded = verifyToken(event.headers.authorization);
      
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

      await store.delete(slug);

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
