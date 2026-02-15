import type { Handler } from '@netlify/functions';
import ogs from 'open-graph-scraper';

interface MetadataResponse {
    title?: string;
    description?: string;
    image?: string;
    icon?: string;
    url: string;
}

export const handler: Handler = async (event, context) => {
    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: 'Method Not Allowed',
        };
    }

    const { url } = event.queryStringParameters || {};

    if (!url) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'URL is required' }),
        };
    }

    try {
        const { result } = await ogs({
            url,
            fetchOptions: {
                headers: {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36'
                }
            }
        });

        // Extract best available metadata
        const metadata: MetadataResponse = {
            title: result.ogTitle || result.twitterTitle || result.dcTitle || (result as any).title,
            description: result.ogDescription || result.twitterDescription || result.dcDescription,
            image: (result.ogImage && result.ogImage[0]?.url) ||
                (result.twitterImage && result.twitterImage[0]?.url),
            icon: result.favicon,
            url: url
        };

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                // Optional: valid for simple requests, or configure detailed CORS if needed
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify(metadata),
        };
    } catch (error) {
        console.error('Error fetching metadata:', error);

        // Return partial data/fallback
        return {
            statusCode: 200, // Return 200 to allow client to use fallback
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                title: url,
                url: url
            }),
        };
    }
};
