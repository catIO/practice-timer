import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DNS so tests do not need real network and can force specific hostnames
// to resolve to disallowed IPs.
const dnsLookupMock = vi.fn<(hostname: string, opts?: unknown) => Promise<{ address: string; family: number }[]>>();
vi.mock('dns/promises', () => ({
    lookup: (hostname: string, opts?: unknown) => dnsLookupMock(hostname, opts),
}));

// Mock open-graph-scraper so we never actually hit the network.
vi.mock('open-graph-scraper', () => ({
    default: vi.fn(),
}));

import ogs from 'open-graph-scraper';
import { handler } from '../../netlify/functions/metadata';

const mockOgs = vi.mocked(ogs);

/** Default: resolve every hostname to a public IP. Individual tests override. */
function resolveToPublic() {
    dnsLookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
}

describe('metadata function', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resolveToPublic();
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

    // --- SSRF hardening ------------------------------------------------------

    it('rejects non-http(s) schemes', async () => {
        const event = {
            httpMethod: 'GET',
            headers: {},
            body: null,
            queryStringParameters: { url: 'file:///etc/passwd' },
        } as any;

        const result = await handler(event, {} as any);
        expect(result!.statusCode).toBe(400);
        expect(mockOgs).not.toHaveBeenCalled();
    });

    it('rejects javascript: URLs', async () => {
        const event = {
            httpMethod: 'GET',
            headers: {},
            body: null,
            queryStringParameters: { url: 'javascript:alert(1)' },
        } as any;

        const result = await handler(event, {} as any);
        expect(result!.statusCode).toBe(400);
        expect(mockOgs).not.toHaveBeenCalled();
    });

    it('rejects literal loopback IP', async () => {
        const event = {
            httpMethod: 'GET',
            headers: {},
            body: null,
            queryStringParameters: { url: 'http://127.0.0.1/admin' },
        } as any;

        const result = await handler(event, {} as any);
        expect(result!.statusCode).toBe(400);
        expect(mockOgs).not.toHaveBeenCalled();
    });

    it('rejects AWS metadata IP (169.254.169.254)', async () => {
        const event = {
            httpMethod: 'GET',
            headers: {},
            body: null,
            queryStringParameters: { url: 'http://169.254.169.254/latest/meta-data/' },
        } as any;

        const result = await handler(event, {} as any);
        expect(result!.statusCode).toBe(400);
        expect(mockOgs).not.toHaveBeenCalled();
    });

    it('rejects RFC1918 addresses', async () => {
        for (const target of ['http://10.0.0.1', 'http://192.168.1.1', 'http://172.20.5.5']) {
            const event = {
                httpMethod: 'GET',
                headers: {},
                body: null,
                queryStringParameters: { url: target },
            } as any;
            const result = await handler(event, {} as any);
            expect(result!.statusCode, `expected ${target} to be rejected`).toBe(400);
        }
        expect(mockOgs).not.toHaveBeenCalled();
    });

    it('rejects IPv6 loopback', async () => {
        const event = {
            httpMethod: 'GET',
            headers: {},
            body: null,
            queryStringParameters: { url: 'http://[::1]/' },
        } as any;

        const result = await handler(event, {} as any);
        expect(result!.statusCode).toBe(400);
        expect(mockOgs).not.toHaveBeenCalled();
    });

    it('rejects hostnames that resolve to private addresses (DNS rebinding)', async () => {
        dnsLookupMock.mockResolvedValueOnce([{ address: '10.0.0.5', family: 4 }]);

        const event = {
            httpMethod: 'GET',
            headers: {},
            body: null,
            queryStringParameters: { url: 'http://evil.example.com/' },
        } as any;

        const result = await handler(event, {} as any);
        expect(result!.statusCode).toBe(400);
        expect(mockOgs).not.toHaveBeenCalled();
    });

    it('rejects hostnames where DNS lookup fails', async () => {
        dnsLookupMock.mockRejectedValueOnce(new Error('ENOTFOUND'));

        const event = {
            httpMethod: 'GET',
            headers: {},
            body: null,
            queryStringParameters: { url: 'http://does-not-exist.example/' },
        } as any;

        const result = await handler(event, {} as any);
        expect(result!.statusCode).toBe(400);
        expect(mockOgs).not.toHaveBeenCalled();
    });

    it('rejects URLs that are too long', async () => {
        const longUrl = 'https://example.com/' + 'a'.repeat(3000);
        const event = {
            httpMethod: 'GET',
            headers: {},
            body: null,
            queryStringParameters: { url: longUrl },
        } as any;

        const result = await handler(event, {} as any);
        expect(result!.statusCode).toBe(400);
        expect(mockOgs).not.toHaveBeenCalled();
    });
});
