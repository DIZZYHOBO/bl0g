const { LemmyHttp } = require('lemmy-js-client');
const jwt = require('jsonwebtoken');

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
    
    const { title, content, community, url } = JSON.parse(event.body);
    
    const client = new LemmyHttp(`https://${decoded.instance}`);
    
    // Get community info
    const communityResponse = await client.getCommunity({
      name: community,
      auth: decoded.lemmyJwt,
    });

    // Create the post
    const postResponse = await client.createPost({
      name: title,
      body: content,
      community_id: communityResponse.community_view.community.id,
      url: url || undefined,
      auth: decoded.lemmyJwt,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        postId: postResponse.post_view.post.id,
        postUrl: `https://${decoded.instance}/post/${postResponse.post_view.post.id}`
      })
    };
  } catch (error) {
    console.error('Post error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to create post' })
    };
  }
};
