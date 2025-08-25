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

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function formatDate(date = new Date()) {
  return date.toISOString().split('T')[0];
}

// Initialize welcome post
async function ensureWelcomePost(store, isBlobs) {
  const welcomeSlug = 'welcome-to-community';
  
  try {
    // Check if welcome post exists
    let exists = false;
    if (isBlobs) {
      try {
        const post = await store.get(welcomeSlug);
        exists = !!post;
      } catch (e) {
        exists = false;
      }
    } else {
      exists = memoryStore.has(welcomeSlug);
    }
    
    if (exists) {
      console.log('Welcome post already exists');
      return;
    }
  } catch (error) {
    console.log('Creating welcome post...');
  }

  const welcomePost = {
    slug: welcomeSlug,
    title: 'Welcome to Our Blog! 🚀',
    description: 'Start sharing your thoughts and ideas',
    content: `# Welcome to Our Blog! 🚀

This is your blog platform where you can share your thoughts, tutorials, and insights with the world.

## 🚀 Getting Started

To contribute:

1. **Login** with your Lemmy account credentials
2. **Click "New Post"** to create content  
3. **Share your expertise** with readers
4. **Engage and learn** from others

## 💡 What You Can Share

- **Tutorials** and coding tips
- **Technology insights** and reviews  
- **Personal projects** and experiences
- **Thoughts and opinions**
- **Technical guides** and how-tos
- **Industry insights** and career advice

## 📝 Writing Tips

- **Use clear, descriptive titles**
- **Add relevant tags** to categorize your posts
- **Write for your audience**
- **Include examples when helpful**

**Ready to get started?** Login with your Lemmy account and share something amazing!

---

*Happy blogging!*`,
    content_preview: 'Welcome to our blog! Start sharing your thoughts and ideas with the world...',
    author: 'Admin',
    date: formatDate(),
    tags: ['welcome', 'getting-started', 'blogging'],
    read_time: 2,
    word_count: 150,
    published: true,
    draft: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    featured: true
  };

  try {
    if (isBlobs) {
      await store.set(welcomeSlug, welcomePost);
    } else {
      memoryStore.set(welcomeSlug, welcomePost);
    }
    console.log('Welcome post created successfully');
  } catch (error) {
    console.error('Error creating welcome post:', error);
  }
}

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { 
      statusCode: 200, 
      headers, 
      body: '' 
    };
  }

  console.log('API called:', event.httpMethod, event.path);

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
      list: async () => {
        try {
          const result = await store.list();
          return { blobs: result.blobs || [] };
        } catch (e) {
          console.error('Blobs list error:', e);
          return { blobs: [] };
        }
      },
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
      list: async () => ({ 
        blobs: Array.from(memoryStore.keys()).map(key => ({ key })) 
      }),
      get: async (key) => memoryStore.get(key) || null,
      set: async (key, value) => memoryStore.set(key, value),
      delete: async (key) => memoryStore.delete(key)
    };

    // Ensure welcome post exists
    await ensureWelcomePost(storage, usingBlobs);

    // GET /api/posts-db - List all posts
    if (event.httpMethod === 'GET') {
      const { page = 1, limit = 10, search, tag, author } = event.queryStringParameters || {};
      
      console.log('GET request with params:', { page, limit, search, tag, author });
      
      // Get all posts
      const { blobs } = await storage.list();
      const allPosts = [];
      
      console.log(`Found ${blobs.length} entries in storage`);
      
      // Fetch all posts
      for (const blob of blobs) {
        try {
          const postData = await storage.get(blob.key);
          if (postData && !postData.draft) {
            allPosts.push(postData);
          }
        } catch (error) {
          console.error(`Error fetching post ${blob.key}:`, error);
        }
      }
      
      console.log(`Loaded ${allPosts.length} published posts`);
      
      // Apply filters
      let filteredPosts = allPosts;
      
      if (search) {
        const searchLower = search.toLowerCase();
        filteredPosts = filteredPosts.filter(post => 
          (post.title && post.title.toLowerCase().includes(searchLower)) ||
          (post.description && post.description.toLowerCase().includes(searchLower)) ||
          (post.content && post.content.toLowerCase().includes(searchLower))
        );
      }
      
      if (tag) {
        filteredPosts = filteredPosts.filter(post => 
          post.tags && Array.isArray(post.tags) && post.tags.includes(tag)
        );
      }
      
      if (author) {
        filteredPosts = filteredPosts.filter(post => post.author === author);
      }

      // Sort by date (newest first), but keep featured posts at top
      filteredPosts.sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        
        const dateA = new Date(a.created_at || a.date || 0);
        const dateB = new Date(b.created_at || b.date || 0);
        return dateB - dateA;
      });

      // Pagination
      const pageNum = parseInt(page);
      const limitNum = Math.min(parseInt(limit), 50);
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      const paginatedPosts = filteredPosts.slice(startIndex, endIndex);

      console.log(`Returning ${paginatedPosts.length} posts out of ${filteredPosts.length} total`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            posts: paginatedPosts,
            pagination: {
              current_page: pageNum,
              per_page: limitNum,
              total_posts: filteredPosts.length,
              total_pages: Math.ceil(filteredPosts.length / limitNum),
              has_next: endIndex < filteredPosts.length,
              has_prev: pageNum > 1
            },
            filters: {
              search: search || null,
              tag: tag || null,
              author: author || null
            },
            meta: {
              total_stored_posts: blobs.length,
              storage_type: usingBlobs ? 'netlify_blobs_persistent' : 'in_memory_temporary'
            }
          }
        })
      };
    }

    // POST /api/posts-db - Create new post
    if (event.httpMethod === 'POST') {
      console.log('POST request received');
      
      const decoded = verifyToken(event.headers.authorization);
      const { title, content, description, tags, isDraft = false } = JSON.parse(event.body);
      
      console.log('Creating post:', { title, isDraft, author: `${decoded.username}@${decoded.instance}` });
      
      if (!title || !content) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: 'validation_error',
            message: 'Title and content are required',
            required_fields: ['title', 'content']
          })
        };
      }

      const slug = generateSlug(title);
      const timestamp = Date.now();
      const uniqueSlug = `${slug}-${timestamp}`;
      
      // Calculate read time
      const wordCount = content.split(/\s+/).length;
      const readTime = Math.ceil(wordCount / 200);
      
      const newPost = {
        slug: uniqueSlug,
        title: title,
        description: description || '',
        content: content,
        content_preview: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
        author: `${decoded.username}@${decoded.instance}`,
        date: formatDate(),
        tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []),
        read_time: readTime,
        word_count: wordCount,
        draft: isDraft,
        published: !isDraft,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author_info: {
          username: decoded.username,
          instance: decoded.instance,
          lemmy_user_id: decoded.lemmyUserId
        }
      };

      // Store the post
      await storage.set(uniqueSlug, newPost);
      
      console.log(`Post saved to ${usingBlobs ? 'Netlify Blobs' : 'memory'}:`, uniqueSlug);

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ 
          success: true,
          message: `Post created and saved ${usingBlobs ? 'permanently to Netlify Blobs' : 'temporarily in memory'}`,
          data: {
            slug: uniqueSlug,
            title: title,
            author: newPost.author,
            status: isDraft ? 'draft' : 'published',
            created_at: newPost.created_at,
            storage_type: usingBlobs ? 'netlify_blobs_persistent' : 'in_memory_temporary',
            url: `${process.env.URL || ''}/posts/${uniqueSlug}`,
            api_url: `${process.env.URL || ''}/.netlify/functions/api-posts-slug-db?slug=${uniqueSlug}`
          }
        })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ 
        error: 'method_not_allowed',
        message: `Method ${event.httpMethod} not supported`
      })
    };

  } catch (error) {
    console.error('API Error:', error);
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
