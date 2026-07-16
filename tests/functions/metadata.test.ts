import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from '../../netlify/functions/metadata';

// Mock open-graph-scraper
vi.mock('open-graph-scraper', () => ({
    default: vi.fn(),
}));

import ogs from 'open-graph-scraper';
const mockOgs = vi.mocked(ogs);

describe('metadata function', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rejects non-GET methods', async () => {
        const event = {
            httpMethod: 'POST',
            headers: {},
            body: null,
            queryStringParameters: null,
        } as any;

        const result = await handler(event, {} as any);
        expect(result!.statusCode).toBe(405);
    });

    it('returns 400 when URL is missing', async () => {
        const event = {
            httpMethod: 'GET',
            headers: {},
            body: null,
            queryStringParameters: {},
        } as any;

        const result = await handler(event, {} as any);
        expect(result!.statusCode).toBe(400);
    });

    it('returns metadata for a valid URL', async () => {
        mockOgs.mockResolvedValue({
            result: {
                ogTitle: 'Test Page',
                ogDescription: 'A test description',
                ogImage: [{ url: 'https://example.com/image.jpg' }],
                favicon: '/favicon.ico',
            },
            error: false,
            html: '',
            response: {} as any,
        } as any);

        const event = {
            httpMethod: 'GET',
            headers: {},
            body: null,
            queryStringParameters: { url: 'https://example.com' },
        } as any;

        const result = await handler(event, {} as any);
        expect(result!.statusCode).toBe(200);
        const body = JSON.parse(result!.body!);
        expect(body.title).toBe('Test Page');
        expect(body.description).toBe('A test description');
        expect(body.image).toBe('https://example.com/image.jpg');
        expect(body.url).toBe('https://example.com');
    });

    it('falls back to twitter metadata', async () => {
        mockOgs.mockResolvedValue({
            result: {
                twitterTitle: 'Twitter Title',
                twitterDescription: 'Twitter desc',
                twitterImage: [{ url: 'https://example.com/twitter.jpg' }],
            },
            error: false,
            html: '',
            response: {} as any,
        } as any);

        const event = {
            httpMethod: 'GET',
            headers: {},
            body: null,
            queryStringParameters: { url: 'https://example.com' },
        } as any;

        const result = await handler(event, {} as any);
        expect(result!.statusCode).toBe(200);
        const body = JSON.parse(result!.body!);
        expect(body.title).toBe('Twitter Title');
        expect(body.description).toBe('Twitter desc');
    });

    it('includes CORS headers', async () => {
        mockOgs.mockResolvedValue({
            result: { ogTitle: 'Test' },
            error: false,
            html: '',
            response: {} as any,
        } as any);

        const event = {
            httpMethod: 'GET',
            headers: {},
            body: null,
            queryStringParameters: { url: 'https://example.com' },
        } as any;

        const result = await handler(event, {} as any);
        expect(result!.headers!['Access-Control-Allow-Origin']).toBe('*');
    });
});
