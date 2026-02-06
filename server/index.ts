import express from 'express';
import cors from 'cors';
import ogs from 'open-graph-scraper';
import type { Request, Response } from 'express';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

interface MetadataResponse {
    title?: string;
    description?: string;
    image?: string;
    icon?: string;
    url: string;
}

app.get('/api/metadata', async (req: Request, res: Response) => {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const { result } = await ogs({ url });

        // Extract best available metadata
        const metadata: MetadataResponse = {
            title: result.ogTitle || result.twitterTitle || result.dcTitle || (result as any).title,
            description: result.ogDescription || result.twitterDescription || result.dcDescription,
            image: (result.ogImage && result.ogImage[0]?.url) ||
                (result.twitterImage && result.twitterImage[0]?.url),
            icon: result.favicon,
            url: url
        };

        res.json(metadata);
    } catch (error) {
        console.error('Error fetching metadata:', error);
        // If OGS fails, usually means not found or invalid URL, or scraped site blocks it.
        // Return partial data using just the URL if possible, or 500.
        // Ideally we return 200 with minimal data so frontend can fallback gracefully.
        res.json({
            title: url,
            url: url
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
