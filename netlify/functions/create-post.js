const jwt = require('jsonwebtoken');
const { Octokit } = require('@octokit/rest');

// Helper function to generate slug from title
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim();
}

// Helper function to format date
function formatDate(date = new Date()) {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD format
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Verify JWT token
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'No authorization header' })
      };
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const { title, content, description, tags, isDraft = false } = JSON.parse(event.body);
    
    if (!title || !content) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Title and content are required' })
      };
    }

    // Generate slug and filename
    const slug = generateSlug(title);
    const timestamp = Date.now();
    const filename = `${slug}-${timestamp}.mdx`;
    
    // Create MDX frontmatter
    const frontmatter = {
      type: 'Post',
      title: title,
      description: description || '',
      date: formatDate(),
      author: `${decoded.username}@${decoded.instance}`,
      tags: tags || [],
      draft: isDraft
    };

    // Create MDX content
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

    // If GitHub integration is available, commit to repo
    if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPO) {
      const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
      });

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

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            success: true, 
            slug: slug,
            filename: filename,
            message: 'Post created and committed to repository'
          })
        };
      } catch (githubError) {
        console.error('GitHub commit error:', githubError);
        // Fall back to just returning success without git commit
      }
    }

    // Return success even without GitHub integration
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        slug: slug,
        filename: filename,
        content: mdxContent,
        message: 'Post created (manual commit required)'
      })
    };

  } catch (error) {
    console.error('Create post error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to create post' })
    };
  }
};
