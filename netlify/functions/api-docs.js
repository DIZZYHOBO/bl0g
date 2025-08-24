exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  const apiDocs = {
    name: 'Blog CMS API',
    version: '1.0.0',
    description: 'REST API for the Lemmy-authenticated blog CMS',
    base_url: process.env.URL + '/.netlify/functions',
    authentication: {
      type: 'Bearer Token',
      description: 'Include Authorization header with Bearer token from login',
      header_format: 'Authorization: Bearer <your_token>'
    },
    endpoints: {
      authentication: {
        login: {
          method: 'POST',
          path: '/api-auth-login',
          description: 'Login with Lemmy credentials',
          body: {
            instance: 'string (required) - Lemmy instance domain',
            username: 'string (required) - Lemmy username',
            password: 'string (required) - Lemmy password'
          },
          responses: {
            200: 'Login successful - returns access_token and user profile',
            401: 'Invalid credentials',
            400: 'Missing required fields'
          }
        },
        me: {
          method: 'GET',
          path: '/api-auth-me',
          description: 'Get current user information',
          auth_required: true,
          responses: {
            200: 'User information',
            401: 'Invalid or expired token'
          }
        }
      },
      posts: {
        list: {
          method: 'GET',
          path: '/api-posts',
          description: 'List all published posts with pagination and filtering',
          query_params: {
            page: 'number - Page number (default: 1)',
            limit: 'number - Posts per page (default: 10, max: 50)',
            search: 'string - Search in title and description',
            tag: 'string - Filter by tag',
            author: 'string - Filter by author'
          }
        },
        get: {
          method: 'GET',
          path: '/api-posts-slug/:slug',
          description: 'Get specific post by slug'
        },
        create: {
          method: 'POST',
          path: '/api-posts',
          description: 'Create new blog post',
          auth_required: true,
          body: {
            title: 'string (required) - Post title',
            content: 'string (required) - Post content (Markdown)',
            description: 'string (optional) - Brief description',
            tags: 'array or string (optional) - Tags',
            isDraft: 'boolean (optional) - Save as draft (default: false)'
          }
        },
        update: {
          method: 'PUT',
          path: '/api-posts-slug/:slug',
          description: 'Update existing post',
          auth_required: true
        },
        delete: {
          method: 'DELETE',
          path: '/api-posts-slug/:slug',
          description: 'Delete post',
          auth_required: true
        }
      },
      user: {
        profile: {
          method: 'GET',
          path: '/api-user-profile',
          description: 'Get user profile with blog statistics',
          auth_required: true
        }
      }
    },
    rate_limits: {
      authenticated: '100 requests per hour',
      unauthenticated: '20 requests per hour'
    },
    examples: {
      login: {
        curl: `curl -X POST ${process.env.URL}/.netlify/functions/api-auth-login \\
  -H "Content-Type: application/json" \\
  -d '{
    "instance": "lemmy.ml",
    "username": "your_username",
    "password": "your_password"
  }'`
      },
      create_post: {
        curl: `curl -X POST ${process.env.URL}/.netlify/functions/api-posts \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{
    "title": "My New Post",
    "content": "# Hello World\\n\\nThis is my blog post content...",
    "description": "A sample blog post",
    "tags": ["tutorial", "api"],
    "isDraft": false
  }'`
      }
    }
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(apiDocs, null, 2)
  };
};
