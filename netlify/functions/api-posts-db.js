const jwt = require('jsonwebtoken');
const { getStore } = require('@netlify/blobs');

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

// Initialize welcome post if none exists
async function ensureWelcomePost(store) {
  const welcomeSlug = 'welcome-to-community';
  
  try {
    // Check if welcome post already exists
    const existingPost = await store.get(welcomeSlug);
    if (existingPost) {
      console.log('Welcome post already exists');
      return;
    }
  } catch (error) {
    // Post doesn't exist, create it
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
    await store.set(welcomeSlug, welcomePost);
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
    // Get the Netlify Blobs store
    // This will automatically use the Netlify Blobs infrastructure
    const store = getStore({
      name: 'blog-posts',
      siteID: context.site?.id, // Use the site ID from context if available
    });

    // Ensure welcome post exists
    await ensureWelcomePost(store);

    // GET /api/posts-db - List all posts
    if (event.httpMethod === 'GET') {
      const { page = 1, limit = 10, search, tag, author } = event.queryStringParameters || {};
      
      console.log('GET request with params:', { page, limit, search, tag, author });
      
      // Get all posts from blob storage
      const { blobs } = await store.list();
      const allPosts = [];
      
      console.log(`Found ${blobs.length} blob entries`);
      
      // Fetch all posts
      for (const blob of blobs) {
        try {
          const postData = await store.get(blob.key);
          if (postData && !postData.draft) {
            allPosts.push(postData);
          }
        } catch (error) {
          console.error(`Error fetching post ${blob.key}:`, error);
        }
      }
      
      console.log(`Loaded ${allPosts.length} published posts from Netlify Blobs`);
      
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
        // Featured posts first
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        
        // Then by date
        const dateA = new Date(a.created_at || a.date);
        const dateB = new Date(b.created_at || b.date);
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
              storage_type: 'netlify_blobs_persistent'
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

      // Store in Netlify Blobs - this persists permanently!
      await store.set(uniqueSlug, newPost);
      
      console.log('Post saved to Netlify Blobs:', uniqueSlug);

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ 
          success: true,
          message: 'Post created and saved permanently to Netlify Blobs',
          data: {
            slug: uniqueSlug,
            title: title,
            author: newPost.author,
            status: isDraft ? 'draft' : 'published',
            created_at: newPost.created_at,
            storage_type: 'netlify_blobs_persistent',
            url: `${process.env.URL || ''}/posts/${uniqueSlug}`,
            api_url: `${process.env.URL || ''}/.netlify/functions/api-post-by-slug?slug=${uniqueSlug}`
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
        message: 'Internal server error',
        details: error.message,
        storage_note: 'Ensure @netlify/blobs is installed: npm install @netlify/blobs'
      })
    };
  }
};
