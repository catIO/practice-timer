import { Handler } from '@netlify/functions';

// Create a handler for API requests
const handler: Handler = async (event, context) => {
  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      },
    };
  }

  // Add CORS headers to all responses
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    // Handle different API endpoints
    const path = event.path.replace('/.netlify/functions/api', '');
    
    switch (path) {
      case '/sessions':
        if (event.httpMethod === 'POST') {
          // For now, just return success
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true }),
          };
        }
        break;

      default:
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Not found' }),
        };
    }
  } catch (error) {
    console.error('API Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

export { handler }; 