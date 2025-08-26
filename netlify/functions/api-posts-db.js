const jwt = require('jsonwebtoken');
const { getStore } = require('@netlify/blobs');

// ONLY THIS USER CAN POST/EDIT/DELETE
const ALLOWED_USER = 'dumbass@leminal.space';

function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Invalid authorization header');
  }
  
  const token = authHeader.substring(7);
  return jwt.verify(token, process.env.JWT_SECRET);
}

function checkIfAllowedUser(username, instance) {
  const fullUsername = `${username}@${instance}`;
  return fullUsername === ALLOWED_USER;
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
    title: 'Welcome to the Blog! 🚀',
    description: 'A personal blog space',
    content: `# Welcome to the Blog! 🚀

This is a personal blog platform.

## Notice

Only authorized users can create, edit, or delete posts.

If you're not authorized, you can still read and enjoy the content!`,
    content_preview: 'A personal blog space...',
    author: 'System',
    date: formatDate(),
    tags: ['welcome'],
    read_time: 1,
    word_count: 50,
    published: true,
    draft: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    featured: true
  };
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
    // Initialize Netlify Blobs with environment variables
    const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
    const token = process.env.NETLIFY_AUTH_TOKEN;
    
    console.log('Blobs config:', {
      has_site_id: !!siteID,
      has_token: !!token,
      site_id_preview: siteID ? siteID.substring(0, 8) + '...' : 'none'
    });
    
    // Get store with explicit configuration
    const store = getStore({
      name: 'blog-posts',
      siteID: siteID,
      token: token
    });
    
    console.log('Netlify Blobs store initialized successfully!');
    
    // GET - List all posts (ANYONE CAN READ)
    if (event.httpMethod === 'GET') {
      const { page = 1, limit = 10, search, tag, author } = event.queryStringParameters || {};
      
      // List all blobs
      const { blobs } = await store.list();
      console.log(`Found ${blobs.length} posts in Netlify Blobs`);
      
        
      // Fetch all posts
      const allPosts = [];
      for (const blob of blobs) {
        try {
          const postData = await store.get(blob.key, { type: 'json' });
          if (postData && !postData.draft) {
            allPosts.push(postData);
          }
        } catch (error) {
          console.error(`Error reading ${blob.key}:`, error);
        }
      }
      
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

      // Sort by date (newest first), featured first
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
              storage_type: 'netlify_blobs_permanent',
              message: 'Using Netlify Blobs - posts are permanently stored!',
              total_stored: blobs.length
            }
          }
        })
      };
    }

    // POST - Create new post (ONLY ALLOWED USER)
    if (event.httpMethod === 'POST') {
      // Verify token first
      const decoded = verifyToken(event.headers.authorization);
      
      // CHECK IF USER IS ALLOWED
      if (!checkIfAllowedUser(decoded.username, decoded.instance)) {
        console.log(`Unauthorized user attempted to post: ${decoded.username}@${decoded.instance}`);
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ 
            error: 'forbidden',
            message: `Sorry, only ${ALLOWED_USER} can create posts on this blog.`,
            your_account: `${decoded.username}@${decoded.instance}`
          })
        };
      }
      
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

      // Save to Netlify Blobs - PERMANENT!
      await store.setJSON(uniqueSlug, newPost);
      console.log('Post saved permanently to Netlify Blobs:', uniqueSlug);

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ 
          success: true,
          message: 'Post created and permanently saved to Netlify Blobs!',
          data: {
            slug: uniqueSlug,
            title: newPost.title,
            url: `/posts/${uniqueSlug}`,
            storage: 'netlify_blobs_permanent'
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
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    if (error.name === 'JsonWebTokenError') {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          error: 'unauthorized',
          message: 'Invalid token - please login'
        })
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'server_error',
        message: error.message,
        type: error.name,
        help: 'Check that NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN are set in environment variables'
      })
    };
  }
};
