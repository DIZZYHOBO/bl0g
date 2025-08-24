const jwt = require('jsonwebtoken');

// Simple in-memory storage for now (will reset on deploy)
let posts = [
  {
    slug: 'welcome-to-community',
    title: 'Welcome to Our Community Blog!',
    description: 'A place where Lemmy users share their thoughts and ideas',
    content: `# Welcome to Our Community Blog!

This is a collaborative space where members of the Lemmy community can share their thoughts, tutorials, and insights.

## Getting Started

To contribute to our community blog:

1. **Login** with your Lemmy account credentials
2. **Click "Write Post"** to create new content  
3. **Share your knowledge** with the community!

## What You Can Share

- Programming tutorials and tips
- Technology insights and reviews  
- Personal projects and experiences
- Community discussions and thoughts
- Open source project updates
- Technical guides and how-tos

## Community Guidelines

- Be respectful and constructive
- Share original content or properly attribute sources
- Use clear, descriptive titles
- Add relevant tags to help others find your content

We're excited to see what you'll contribute to our growing community! Every post helps make this a valuable resource for Lemmy users everywhere.

Happy blogging! 🚀`,
    content_preview: 'Welcome to our community blog! This is a collaborative space where members of the Lemmy community can share their thoughts, tutorials, and insights...',
    author: 'Community Team',
    date: new Date().toISOString().split('T')[0],
    tags: ['welcome', 'community', 'getting-started'],
    read_time: 3,
    word_count: 180,
    published: true,
    draft: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

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
    // GET /api/posts-db - List all posts
    if (event.httpMethod === 'GET') {
      const { page = 1, limit = 10, search, tag, author } = event.queryStringParameters || {};
      
      console.log('GET request with params:', { page, limit, search, tag, author });
      
      // Filter published posts
      let filteredPosts = posts.filter(post => !post.draft);
      
      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase();
        filteredPosts = filteredPosts.filter(post => 
          post.title.toLowerCase().includes(searchLower) ||
          post.description.toLowerCase().includes(searchLower) ||
          post.content.toLowerCase().includes(searchLower)
        );
      }
      
      // Apply tag filter
      if (tag) {
        filteredPosts = filteredPosts.filter(post => 
          post.tags && post.tags.includes(tag)
        );
      }
      
      // Apply author filter  
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
        updated_at: new Date().toISOString()
      };

      // Add to beginning of posts array
      posts.unshift(newPost);
      
      console.log('Post created successfully:', uniqueSlug);

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ 
          success: true,
          message: 'Post created successfully',
          data: {
            slug: uniqueSlug,
            title: title,
            author: newPost.author,
            status: isDraft ? 'draft' : 'published',
            created_at: newPost.created_at,
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
