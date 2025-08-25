const jwt = require('jsonwebtoken');
const { getStore } = require('@netlify/blobs');

// In-memory fallback
const memoryStore = new Map();

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

function createWelcomePost() {
  return {
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

## What You Can Share

- Tutorials and guides
- Technology insights
- Personal projects
- Thoughts and opinions

Happy blogging!`,
    content_preview: 'Welcome to your blog! Start sharing your thoughts and ideas with the world...',
    author: 'Admin',
    date: formatDate(),
    tags: ['welcome', 'getting-started'],
    read_time: 1,
    word_count: 80,
    published: true,
    draft: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    featured: true
  };
}

// Ensure welcome post in memory
if (memoryStore.size === 0) {
  memoryStore.set('welcome-to-blog', createWelcomePost());
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  console.log('API called:', event.httpMethod, event.path);

  try {
    // Try to initialize Netlify Blobs with proper configuration
    let store = null;
    let usingBlobs = false;
    
    // Check if we have the required environment variables for Blobs
    const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID || context?.site?.id;
    const deployID = process.env.DEPLOY_ID || process.env.NETLIFY_DEPLOY_ID;
    
    console.log('Environment check:', {
      has_site_id: !!siteID,
      has_deploy_id: !!deployID,
      context_available: !!context
    });
    
    // For now, we'll use in-memory storage since Blobs isn't configured
    // Netlify Blobs requires additional setup in the Netlify dashboard
    console.log('Using in-memory storage (temporary)');
    
    // Create storage wrapper for in-memory
    const storage = {
      list: async () => {
        const keys = Array.from(memoryStore.keys());
        return { blobs: keys.map(key => ({ key })) };
      },
      get: async (key) => memoryStore.get(key) || null,
      setJSON: async (key, value) => memoryStore.set(key, value),
      delete: async (key) => memoryStore.delete(key)
    };
    
    // GET - List all posts
    if (event.httpMethod === 'GET') {
      const { page = 1, limit = 10, search, tag, author } = event.queryStringParameters || {};
      
      console.log('Fetching posts with params:', { page, limit, search, tag, author });
      
      // Get all posts
      const { blobs } = await storage.list();
      console.log(`Found ${blobs.length} posts in storage`);
      
      // Fetch all posts
      const allPosts = [];
      for (const blob of blobs) {
        const postData = await storage.get(blob.key);
        if (postData && !postData.draft) {
          allPosts.push(postData);
        }
      }
      
      console.log(`Loaded ${allPosts.length} published posts`);
      
      // Apply filters
      let filteredPosts = allPosts;
      
      if (search) {
        const searchLower = search.toLowerCase();
        filteredPosts = filteredPosts.filter(post => 
          (post.title?.toLowerCase().includes(searchLower)) ||
          (post.description?.toLowerCase().includes(searchLower)) ||
          (post.content?.toLowerCase().includes(searchLower))
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

      // Sort by date
      filteredPosts.sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      });

      // Pagination
      const pageNum = parseInt(page);
      const limitNum = Math.min(parseInt(limit), 50);
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      const paginatedPosts = filteredPosts.slice(startIndex, endIndex);

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
            meta: {
              storage_type: 'in_memory_temporary',
              message: 'Using temporary storage. Posts will be lost on function restart.',
              total_stored: blobs.length
            }
          }
        })
      };
    }

    // POST - Create new post
    if (event.httpMethod === 'POST') {
      const decoded = verifyToken(event.headers.authorization);
      const { title, content, description, tags, isDraft = false } = JSON.parse(event.body);
      
      if (!title || !content) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: 'validation_error',
            message: 'Title and content are required'
          })
        };
      }

      const uniqueSlug = `${generateSlug(title)}-${Date.now()}`;
      const wordCount = content.split(/\s+/).length;
      
      const newPost = {
        slug: uniqueSlug,
        title,
        description: description || '',
        content,
        content_preview: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
        author: `${decoded.username}@${decoded.instance}`,
        date: formatDate(),
        tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []),
        read_time: Math.ceil(wordCount / 200),
        word_count: wordCount,
        draft: isDraft,
        published: !isDraft,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await storage.setJSON(uniqueSlug, newPost);
      console.log('Post saved to storage:', uniqueSlug);

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ 
          success: true,
          message: 'Post created successfully (temporary storage)',
          data: {
            slug: uniqueSlug,
            title: newPost.title,
            url: `/posts/${uniqueSlug}`
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
