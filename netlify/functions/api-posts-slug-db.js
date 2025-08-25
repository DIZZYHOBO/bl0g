const jwt = require('jsonwebtoken');

// Share the same memory store with api-posts-db.js
// IMPORTANT: Use the exact same global variable name
if (!global.blogPostsMemoryStore) {
  global.blogPostsMemoryStore = new Map();
}
const memoryStore = global.blogPostsMemoryStore;

// Initialize with welcome post if empty
function ensureWelcomePost() {
  const welcomeSlug = 'welcome-to-community';
  
  if (!memoryStore.has(welcomeSlug)) {
    const welcomePost = {
      slug: welcomeSlug,
      title: 'Welcome to Our Community Blog! 🚀',
      description: 'A place where Lemmy users share their thoughts, ideas, and expertise',
      content: `# Welcome to Our Community Blog! 🚀

This is a collaborative space where members of the Lemmy community can share their thoughts, tutorials, and insights with the world.

## 🌟 What Makes This Special

This isn't just another blog - it's a **community-driven platform** where every Lemmy user can contribute and share their knowledge.

## 🚀 Getting Started

To contribute to our growing community:

1. **Login** with your Lemmy account credentials from any instance
2. **Click "Write Post"** to create new content  
3. **Share your expertise** with fellow community members
4. **Engage and learn** from others' contributions

## 💡 What You Can Share

- **Programming tutorials** and coding tips
- **Technology insights** and product reviews  
- **Personal projects** and development experiences
- **Community discussions** and thoughtful opinions
- **Open source contributions** and project updates
- **Technical guides** and comprehensive how-tos
- **Industry insights** and career advice

## 📝 Content Guidelines

To maintain a high-quality community resource:

- **Be respectful and constructive** in all interactions
- **Share original content** or properly attribute sources
- **Use clear, descriptive titles** that help others find your content
- **Add relevant tags** to categorize your posts effectively
- **Write for your audience** - assume readers want to learn

## 🎯 Our Mission

We're building more than just a blog - we're creating a **knowledge hub** where the Lemmy community can:
- Share expertise across different domains
- Learn from each other's experiences
- Build connections beyond individual instances
- Create a lasting resource for future community members

## 🤝 Join the Conversation

Every post contributes to our collective knowledge base. Whether you're sharing a quick tip or writing an in-depth tutorial, your contribution matters.

**Ready to get started?** Login with your Lemmy account and share something amazing with our community!

---

*This platform is built by the community, for the community. Happy blogging!*`,
      content_preview: 'Welcome to our community blog! A collaborative space where Lemmy users share thoughts, tutorials, and insights. Login with your Lemmy account to start contributing...',
      author: 'Community Team',
      date: new Date().toISOString().split('T')[0],
      tags: ['welcome', 'community', 'getting-started', 'blogging'],
      read_time: 4,
      word_count: 320,
      published: true,
      draft: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      featured: true
    };

    memoryStore.set(welcomeSlug, welcomePost);
    console.log('Welcome post created in memory');
  }
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

  // Initialize welcome post
  ensureWelcomePost();

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

    // Extract slug from query parameters
    const slug = event.queryStringParameters?.slug;
    
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

    // GET - Get specific post
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
                  api_url: `${process.env.URL}/.netlify/functions/api-post-by-slug?slug=${slug}`,
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

    // PUT - Update post (authenticated)
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

    // DELETE - Delete post (authenticated)
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
        message: 'Internal server error',
        details: error.message
      })
    };
  }
};
