interface ApiRequestOptions {
  method: string;
  endpoint: string;
  body?: any;
}

export async function apiRequest(method: string, endpoint: string, body?: any) {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(endpoint, options);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return response.json();
} 