const jwt = require('jsonwebtoken');

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
    
    // For now, return mock data since we're using file-based posts
    // In a real implementation, you'd read from your posts directory
    const mockDrafts = [
      {
        id: '1',
        title: 'My First Draft',
        description: 'This is a draft post',
        author: `${decoded.username}@${decoded.instance}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        drafts: mockDrafts
      })
    };

  } catch (error) {
    console.error('Get drafts error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to get drafts' })
    };
  }
};
