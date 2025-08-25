// netlify/functions/test-blobs.js
// Test function to verify Netlify Blobs is working

const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    // Get the store
    const store = getStore('blog-posts');
    
    // Test write
    const testKey = 'test-' + Date.now();
    const testData = {
      message: 'This is a test',
      timestamp: new Date().toISOString(),
      deployment: process.env.DEPLOY_ID || 'unknown'
    };
    
    // Write test data
    await store.setJSON(testKey, testData);
    
    // Read it back
    const readBack = await store.get(testKey, { type: 'json' });
    
    // List all items
    const { blobs } = await store.list();
    
    // Clean up test data
    await store.delete(testKey);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Netlify Blobs is working correctly!',
        test: {
          wrote: testData,
          read: readBack,
          totalItems: blobs.length,
          items: blobs.slice(0, 5).map(b => b.key) // First 5 keys
        },
        environment: {
          hasContext: !!context,
          hasSiteId: !!context?.site?.id,
          deployId: process.env.DEPLOY_ID,
          isNetlify: !!process.env.NETLIFY
        }
      }, null, 2)
    };
    
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
        tip: 'Check if @netlify/blobs is installed: npm install @netlify/blobs'
      }, null, 2)
    };
  }
};
