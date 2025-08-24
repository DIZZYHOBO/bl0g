const jwt = require('jsonwebtoken');

// This needs to match the posts from api-posts-db.js
// In a real app, you'd use shared storage
const samplePosts = {
  'welcome-to-community': {
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
};

function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Invalid authorization header');
  }
  
  const token = authHeader.substring(7);
  return jwt.verify(token, process.env.JWT_SECRET);
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
    // Extract slug from path - handle different path formats
    let slug = '';
    
    // Try different path extraction methods
    if (event.pathParameters && event.pathParameters.slug) {
      slug = event.pathParameters.slug;
    } else {
      const pathParts = event.path.split('/');
      slug = pathParts[pathParts.length - 1];
    }
    
    // Remove query parameters if any
    slug = slug.split('?')[0];
    
    console.log('Looking for post with slug:', slug);
    console.log('Available posts:', Object.keys(samplePosts));

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

    // GET /api/posts-slug-db/:slug - Get specific post
    if (event.httpMethod === 'GET') {
      
      // Check if we have this specific post
      let post = samplePosts[slug];
      
      // If not found, create a generic post for any slug
      if (!post) {
        console.log('Post not found in samples, creating generic post for:', slug);
        post = {
          slug: slug,
          title: `Blog Post: ${slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
          description: 'A community blog post',
          content: `# ${slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}

This is a blog post from our community. 

## Content

This post was created by a member of our Lemmy community. We're building a collaborative space where users can share their thoughts, tutorials, and insights.

## Join the Discussion

Want to contribute your own posts? Login with your Lemmy account and start sharing!

---

*This post is part of our community-driven blog platform.*`,
          author: 'Community Member',
          date: new Date().toISOString().split('T')[0],
          tags: ['community', 'blog'],
          read_time: 2,
          word_count: 50,
          published: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }

      console.log('Returning post:', post.title);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            post: post,
            meta: {
              api_url: `${process.env.URL}/.netlify/functions/api-posts-slug-db/${slug}`,
              web_url: `${process.env.URL}/posts/${slug}`,
              edit_url: `${process.env.URL}/admin?edit=${slug}`
            }
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
    console.error('Single post API error:', error);
    
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
