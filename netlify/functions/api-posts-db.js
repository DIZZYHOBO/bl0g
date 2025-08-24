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

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const store = getStore('blog-posts');

    // GET /api/posts - List all posts
    if (event.httpMethod === 'GET') {
      const { page = 1, limit = 10, search, tag, author } = event.queryStringParameters || {};
      
      console.log('Fetching posts from Netlify Blobs...');
      
      // Get all posts from blob storage
      const { blobs } = await store.list();
      const allPosts = [];
      
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
      
      console.log(`Found ${allPosts.length} published posts`);
      
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

      // Sort by date (newest first)
      filteredPosts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

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
            filters: {
              search: search || null,
              tag: tag || null,
              author: author || null
            }
          }
        })
      };
    }

    // POST /api/posts - Create new post
    if (event.httpMethod === 'POST') {
      const decoded = verifyToken(event.headers.authorization);
      const { title, content, description, tags, isDraft = false } = JSON.parse(event.body);
      
      console.log('Creating new post:', title);
      
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
      
      const postData = {
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

      // Store in Netlify Blobs
      await store.set(uniqueSlug, JSON.stringify(postData));
      
      console.log('Post saved to Netlify Blobs:', uniqueSlug);

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ 
          success: true,
          message: 'Post created successfully',
          data: {
            slug: uniqueSlug,
            title: title,
            author: postData.author,
            status: isDraft ? 'draft' : 'published',
            created_at: postData.created_at,
            url: `${process.env.URL || 'https://yoursite.netlify.app'}/posts/${uniqueSlug}`,
            api_url: `${process.env.URL || 'https://yoursite.netlify.app'}/.netlify/functions/api-posts-slug/${uniqueSlug}`
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
    console.error('Posts API error:', error);
    
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
