const jwt = require('jsonwebtoken');

// Simple in-memory storage as fallback
// IMPORTANT: Share this store across all functions
if (!global.blogPostsMemoryStore) {
  global.blogPostsMemoryStore = new Map();
}
const memoryStore = global.blogPostsMemoryStore;

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
async function ensureWelcomePost() {
  const welcomeSlug = 'welcome-to-community';
  
  if (memoryStore.has(welcomeSlug)) {
    return;
  }

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
    date: formatDate(),
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
        list: async () => ({ blobs: Array.from(memoryStore.keys()).map(key => ({ key })) }),
        get: async (key) => memoryStore.get(key),
        set: async (key, value) => memoryStore.set(key, JSON.parse(value)),
        delete: async (key) => memoryStore.delete(key)
      };
    }

    // Ensure welcome post exists
    await ensureWelcomePost();

    // GET /api/posts-db - List all posts
    if (event.httpMethod === 'GET') {
      const { page = 1, limit = 10, search, tag, author } = event.queryStringParameters || {};
      
      console.log('GET request with params:', { page, limit, search, tag, author });
      
      // Get all posts
      const allPosts = [];
      
      if (usingBlobs) {
        const { blobs } = await store.list();
        console.log(`Found ${blobs.length} blob entries`);
        
        for (const { key } of blobs) {
          try {
            const postData = await store.get(key, { type: 'json' });
            if (postData && !postData.draft) {
              allPosts.push(postData);
            }
          } catch (error) {
            console.error(`Error fetching post ${key}:`, error);
          }
        }
      } else {
        // Using memory storage
        for (const [key, postData] of memoryStore.entries()) {
          if (postData && !postData.draft) {
            allPosts.push(postData);
          }
        }
      }
      
      console.log(`Loaded ${allPosts.length} published posts from storage`);
      
      // Apply filters
      let filteredPosts = allPosts;
      
      if (search) {
        const searchLower = search.toLowerCase();
        filteredPosts = filteredPosts.filter(post => 
          post.title.toLowerCase().includes(searchLower) ||
          post.description.toLowerCase().includes(searchLower) ||
          post.content.toLowerCase().includes(searchLower)
        );
      }
      
      if (tag) {
        filteredPosts = filteredPosts.filter(post => 
          post.tags && post.tags.includes(tag)
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
        return new Date(b.created_at) - new Date(a.created_at);
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
              total_stored_posts: allPosts.length,
              storage_type: usingBlobs ? 'netlify_blobs' : 'in_memory',
              note: usingBlobs ? 'Using persistent Netlify Blobs storage' : 'Using temporary in-memory storage (posts will be lost on restart)'
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
      if (usingBlobs) {
        await store.set(uniqueSlug, JSON.stringify(newPost));
        console.log('Post saved to Netlify Blobs:', uniqueSlug);
      } else {
        memoryStore.set(uniqueSlug, newPost);
        console.log('Post saved to memory:', uniqueSlug);
      }

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ 
          success: true,
          message: usingBlobs ? 'Post created and saved permanently' : 'Post created (temporary storage)',
          data: {
            slug: uniqueSlug,
            title: title,
            author: newPost.author,
            status: isDraft ? 'draft' : 'published',
            created_at: newPost.created_at,
            storage_type: usingBlobs ? 'netlify_blobs_persistent' : 'in_memory_temporary',
            url: `${process.env.URL || ''}/posts/${uniqueSlug}`,
            api_url: `${process.env.URL || ''}/.netlify/functions/api-posts-slug-db/${uniqueSlug}`
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
        details: error.message
      })
    };
  }
};
