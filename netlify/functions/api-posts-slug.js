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

// Function to get single post from GitHub repo
async function getPostFromRepo(slug) {
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) {
    return null;
  }

  try {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    const [owner, repo] = process.env.GITHUB_REPO.split('/');
    
    // Get all files in posts directory
    const { data: files } = await octokit.repos.getContent({
      owner,
      repo,
      path: 'posts',
    });

    // Find the post file by slug
    const postFile = files.find(file => {
      const fileSlug = file.name.replace(/\.(mdx|md)$/, '');
      return fileSlug === slug || fileSlug.includes(slug);
    });

    if (!postFile) {
      return null;
    }

    // Get file content
    const { data: fileData } = await octokit.repos.getContent({
      owner,
      repo,
      path: postFile.path,
    });
    
    const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
    const { data: frontmatter, content: markdownContent } = matter(content);
    
    // Skip drafts
    if (frontmatter.draft) {
      return null;
    }
    
    // Calculate read time
    const wordCount = markdownContent.split(/\s+/).length;
    const readTime = Math.ceil(wordCount / 200);
    
    return {
      slug,
      title: frontmatter.title || 'Untitled',
      description: frontmatter.description || '',
      content: markdownContent,
      author: frontmatter.author || 'Unknown',
      date: frontmatter.date || new Date().toISOString().split('T')[0],
      tags: frontmatter.tags || [],
      read_time: readTime,
      word_count: wordCount,
      published: !frontmatter.draft,
      created_at: frontmatter.date ? new Date(frontmatter.date).toISOString() : new Date().toISOString(),
      updated_at: fileData.last_modified || new Date().toISOString(),
      filename: postFile.name
    };
    
  } catch (error) {
    console.error('Error fetching post from GitHub:', error);
    return null;
  }
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

  try {
    // Extract slug from path
    const pathParts = event.path.split('/');
    const slug = pathParts[pathParts.length - 1];

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

    // GET /api/posts/:slug - Get specific post
    if (event.httpMethod === 'GET') {
      const post = await getPostFromRepo(slug);
      
      if (!post) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            error: 'not_found',
            message: 'Post not found'
          })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            post: post,
            meta: {
              api_url: `${process.env.URL}/.netlify/functions/api-posts-slug/${slug}`,
              web_url: `${process.env.URL}/posts/${slug}`,
              edit_url: `${process.env.URL}/admin?edit=${slug}`
            }
          }
        })
      };
    }

    // PUT and DELETE methods would go here for authenticated users
    // For now, just return method not allowed

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
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'server_error',
        message: 'Internal server error'
      })
    };
  }
};
