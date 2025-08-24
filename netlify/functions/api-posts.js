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

// Function to get posts from GitHub repo with better debugging
async function getPostsFromRepo() {
  console.log('Getting posts from repo...');
  console.log('GITHUB_TOKEN exists:', !!process.env.GITHUB_TOKEN);
  console.log('GITHUB_REPO:', process.env.GITHUB_REPO);

  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) {
    console.log('Missing GitHub configuration');
    return [];
  }

  try {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    const [owner, repo] = process.env.GITHUB_REPO.split('/');
    
    console.log('Fetching from:', owner, '/', repo);
    
    // Get all files in posts directory
    const { data: files } = await octokit.repos.getContent({
      owner,
      repo,
      path: 'posts',
    });

    console.log('Found', files.length, 'files in posts directory');

    const posts = [];
    
    // Process each MDX file
    for (const file of files) {
      if (file.name.endsWith('.mdx') || file.name.endsWith('.md')) {
        console.log('Processing file:', file.name);
        try {
          // Get file content
          const { data: fileData } = await octokit.repos.getContent({
            owner,
            repo,
            path: file.path,
          });
          
          const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
          const { data: frontmatter, content: markdownContent } = matter(content);
          
          console.log('File frontmatter:', frontmatter);
          
          // Skip drafts unless specifically requested
          if (frontmatter.draft) {
            console.log('Skipping draft:', file.name);
            continue;
          }
          
          // Generate slug from filename
          const slug = file.name.replace(/\.(mdx|md)$/, '');
          
          // Calculate read time (roughly 200 words per minute)
          const wordCount = markdownContent.split(/\s+/).length;
          const readTime = Math.ceil(wordCount / 200);
          
          const post = {
            slug,
            title: frontmatter.title || 'Untitled',
            description: frontmatter.description || '',
            content: markdownContent,
            content_preview: markdownContent.substring(0, 200) + '...',
            author: frontmatter.author || 'Unknown',
            date: frontmatter.date || formatDate(),
            tags: frontmatter.tags || [],
            read_time: readTime,
            word_count: wordCount,
            published: !frontmatter.draft,
            created_at: frontmatter.date ? new Date(frontmatter.date).toISOString() : new Date().toISOString(),
            updated_at: fileData.last_modified || new Date().toISOString(),
            filename: file.name
          };
          
          posts.push(post);
          console.log('Added post:', post.title);
        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error);
        }
      }
    }
    
    console.log('Total posts processed:', posts.length);
    // Sort by date (newest first)
    return posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
  } catch (error) {
    console.error('Error fetching posts from GitHub:', error.message);
    if (error.status === 404) {
      console.log('Posts directory not found - creating with example post');
      return getExamplePosts();
    }
    return [];
  }
}

// Provide example posts when GitHub is not available
function getExamplePosts() {
  return [
    {
      slug: 'welcome-to-community-blog',
      title: 'Welcome to Our Community Blog!',
      description: 'Getting started with our Lemmy-powered community blog platform',
      content: `# Welcome to Our Community Blog!

This is a community-driven blog where Lemmy users can share their thoughts, tutorials, and insights.

## How to Get Started

1. **Login** with your Lemmy account credentials
2. **Click "Write Post"** to create new content  
3. **Share your knowledge** with the community!

## What You Can Share

- Programming tutorials and tips
- Technology insights and reviews
- Personal projects and experiences
- Community discussions and thoughts

We're excited to see what you'll contribute to our growing community!`,
      content_preview: 'Welcome to our community blog! This is a place where Lemmy users can share their thoughts, tutorials, and insights...',
      author: 'Community Team',
      date: formatDate(),
      tags: ['welcome', 'community', 'getting-started'],
      read_time: 2,
      word_count: 150,
      published: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      filename: 'welcome.mdx'
    }
  ];
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
      
      console.log('GET /api/posts called with params:', { page, limit, search, tag, author });
      
      // Get posts from GitHub repo or examples
      let allPosts = await getPostsFromRepo();
      if (allPosts.length === 0) {
        console.log('No posts from GitHub, using example posts');
        allPosts = getExamplePosts();
      }
      
      let filteredPosts = allPosts;
      
      // Apply filters
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

      // Pagination
      const pageNum = parseInt(page);
      const limitNum = Math.min(parseInt(limit), 50); // Max 50 per page
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
            debug_info: {
              github_configured: !!(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO),
              total_found: allPosts.length,
              filtered_count: filteredPosts.length
            }
          }
        })
      };
    }

    // POST /api/posts - Create new post
    if (event.httpMethod === 'POST') {
      console.log('POST /api/posts called');
      const decoded = verifyToken(event.headers.authorization);
      const { title, content, description, tags, isDraft = false } = JSON.parse(event.body);
      
      console.log('Creating post:', { title, author: `${decoded.username}@${decoded.instance}`, isDraft });
      
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
      return value.length > 0 ? `${key}:\n${value.map(item => `  - ${item}`).join('\n')}` : `${key}: []`;
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
      let githubSuccess = false;
      if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPO) {
        console.log('Attempting to commit to GitHub...');
        const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
        const [owner, repo] = process.env.GITHUB_REPO.split('/');
        
        try {
          const result = await octokit.repos.createOrUpdateFileContents({
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
          githubSuccess = true;
          console.log('Successfully committed to GitHub:', result.data.commit.sha);
        } catch (githubError) {
          console.error('GitHub commit error:', githubError.message);
        }
      } else {
        console.log('GitHub not configured - post created but not committed');
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
            github_committed: githubSuccess,
            url: `${process.env.URL || 'https://yoursite.netlify.app'}/posts/${slug}`,
            api_url: `${process.env.URL || 'https://yoursite.netlify.app'}/.netlify/functions/api-posts-slug/${slug}`,
            mdx_content: mdxContent // Include for debugging
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
