const jwt = require('jsonwebtoken');
const { Octokit } = require('@octokit/rest');
const matter = require('gray-matter');

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
    // GET /api/posts - List all posts
    if (event.httpMethod === 'GET') {
      const { page = 1, limit = 10, search, tag, author } = event.queryStringParameters || {};
      
      // Mock data for demo - in real app, you'd query your posts
      const mockPosts = [
        {
          slug: 'my-first-post',
          title: 'My First Blog Post',
          description: 'This is my first post using the API',
          author: 'user@lemmy.ml',
          date: '2025-01-15',
          tags: ['introduction', 'api'],
          content_preview: 'Welcome to my blog! This post was created using...',
          read_time: 3,
          published: true,
          created_at: '2025-01-15T10:00:00Z',
          updated_at: '2025-01-15T10:00:00Z'
        },
        {
          slug: 'api-tutorial',
          title: 'Building APIs with Netlify Functions',
          description: 'A comprehensive guide to building REST APIs',
          author: 'developer@lemmy.world',
          date: '2025-01-14',
          tags: ['tutorial', 'api', 'netlify'],
          content_preview: 'In this tutorial, we will learn how to build...',
          read_time: 8,
          published: true,
          created_at: '2025-01-14T15:30:00Z',
          updated_at: '2025-01-14T16:00:00Z'
        }
      ];

      let filteredPosts = mockPosts;
      
      // Apply filters
      if (search) {
        filteredPosts = filteredPosts.filter(post => 
          post.title.toLowerCase().includes(search.toLowerCase()) ||
          post.description.toLowerCase().includes(search.toLowerCase())
        );
      }
      
      if (tag) {
        filteredPosts = filteredPosts.filter(post => post.tags.includes(tag));
      }
      
      if (author) {
        filteredPosts = filteredPosts.filter(post => post.author === author);
      }

      // Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedPosts = filteredPosts.slice(startIndex, endIndex);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            posts: paginatedPosts,
            pagination: {
              current_page: parseInt(page),
              per_page: parseInt(limit),
              total_posts: filteredPosts.length,
              total_pages: Math.ceil(filteredPosts.length / limit),
              has_next: endIndex < filteredPosts.length,
              has_prev: page > 1
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
      const filename = `${slug}-${timestamp}.mdx`;
      
      const frontmatter = {
        type: 'Post',
        title: title,
        description: description || '',
        date: formatDate(),
        author: `${decoded.username}@${decoded.instance}`,
        tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : []),
        draft: isDraft
      };

      const mdxContent = `---
${Object.entries(frontmatter)
  .map(([key, value]) => {
    if (Array.isArray(value)) {
      return `${key}:\n${value.map(item => `  - ${item}`).join('\n')}`;
    } else if (typeof value === 'boolean') {
      return `${key}: ${value}`;
    } else {
      return `${key}: '${value}'`;
    }
  })
  .join('\n')}
---

${content}
`;

      // GitHub integration (if configured)
      if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPO) {
        const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
        const [owner, repo] = process.env.GITHUB_REPO.split('/');
        
        try {
          await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: `posts/${filename}`,
            message: `Add new blog post: ${title}`,
            content: Buffer.from(mdxContent).toString('base64'),
            author: {
              name: decoded.username,
              email: `${decoded.username}@${decoded.instance}`,
            },
          });
        } catch (githubError) {
          console.error('GitHub commit error:', githubError);
        }
      }

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ 
          success: true,
          message: 'Post created successfully',
          data: {
            slug: slug,
            filename: filename,
            title: title,
            author: `${decoded.username}@${decoded.instance}`,
            status: isDraft ? 'draft' : 'published',
            created_at: new Date().toISOString(),
            url: `${process.env.URL}/posts/${slug}`,
            api_url: `${process.env.URL}/.netlify/functions/api-posts/${slug}`
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
