const jwt = require('jsonwebtoken');
const { getStore } = require('@netlify/blobs');

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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const decoded = verifyToken(event.headers.authorization);
    const store = getStore('blog-posts');
    
    const authorFilter = `${decoded.username}@${decoded.instance}`;
    console.log('Fetching posts for author:', authorFilter);

    // Get all posts from blob storage
    const { blobs } = await store.list();
    const userPosts = [];
    
    for (const { key } of blobs) {
      try {
        const postData = await store.get(key, { type: 'json' });
        if (postData && postData.author === authorFilter) {
          userPosts.push(postData);
        }
      } catch (error) {
        console.error(`Error fetching post ${key}:`, error);
      }
    }

    // Sort by date (newest first)
    userPosts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Calculate stats
    const publishedPosts = userPosts.filter(post => !post.draft);
    const draftPosts = userPosts.filter(post => post.draft);
    const totalWords = userPosts.reduce((sum, post) => sum + (post.word_count || 0), 0);
    const avgReadTime = userPosts.length ? userPosts.reduce((sum, post) => sum + (post.read_time || 0), 0) / userPosts.length : 0;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          posts: userPosts,
          stats: {
            total_posts: userPosts.length,
            published_posts: publishedPosts.length,
            draft_posts: draftPosts.length,
            total_words: totalWords,
            avg_read_time: Math.round(avgReadTime * 10) / 10,
            most_used_tags: getMostUsedTags(userPosts),
            latest_post_date: userPosts.length ? userPosts[0].created_at : null
          }
        }
      })
    };

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid token' })
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server error' })
    };
  }
};

function getMostUsedTags(posts) {
  const tagCounts = {};
  posts.forEach(post => {
    if (post.tags) {
      post.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    }
  });
  
  return Object.entries(tagCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([tag]) => tag);
}
