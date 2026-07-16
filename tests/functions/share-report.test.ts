import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from '../../netlify/functions/share-report';

// Mock @netlify/blobs
vi.mock('@netlify/blobs', () => ({
    connectLambda: vi.fn(),
    getStore: vi.fn(),
}));

// Mock nanoid
vi.mock('nanoid', () => ({
    nanoid: vi.fn(() => 'test-id-01'),
}));

// Mock fs with in-memory storage for roundtrip tests
const fileStore: Record<string, string> = {};
vi.mock('fs', () => ({
    existsSync: vi.fn((path: string) => path in fileStore || path.includes('tmp')),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn((path: string) => fileStore[path] ?? '{}'),
    writeFileSync: vi.fn((path: string, data: string) => { fileStore[path] = data; }),
    default: {
        existsSync: (path: string) => path in fileStore || path.includes('tmp'),
        mkdirSync: () => { },
        readFileSync: (path: string) => fileStore[path] ?? '{}',
        writeFileSync: (path: string, data: string) => { fileStore[path] = data; },
    },
}));

describe('share-report function', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Clear the in-memory file store
        Object.keys(fileStore).forEach(key => delete fileStore[key]);
        process.env.NETLIFY_DEV = 'true';
    });

    it('handles CORS preflight', async () => {
        const event = {
            httpMethod: 'OPTIONS',
            headers: {},
            body: null,
            queryStringParameters: null,
        } as any;

        const result = await handler(event, {} as any);
        expect(result!.statusCode).toBe(200);
        expect(result!.headers!['Access-Control-Allow-Origin']).toBe('*');
    });

    it('returns 400 for POST without body', async () => {
        const event = {
            httpMethod: 'POST',
            headers: {},
            body: null,
            queryStringParameters: null,
        } as any;

        const result = await handler(event, {} as any);
        expect(result!.statusCode).toBe(400);
    });

    it('returns 200 with id for valid POST', async () => {
        const event = {
            httpMethod: 'POST',
            headers: {},
            body: JSON.stringify({ title: 'My Report', items: [] }),
            queryStringParameters: null,
        } as any;

        const result = await handler(event, {} as any);
        expect(result!.statusCode).toBe(200);
        const body = JSON.parse(result!.body!);
        expect(body.id).toBe('test-id-01');
    });

    it('uses provided id for POST', async () => {
        const event = {
            httpMethod: 'POST',
            headers: {},
            body: JSON.stringify({ id: 'custom-id', title: 'Report' }),
            queryStringParameters: null,
        } as any;

        const result = await handler(event, {} as any);
        expect(result!.statusCode).toBe(200);
        const body = JSON.parse(result!.body!);
        expect(body.id).toBe('custom-id');
    });

    it('returns 400 for GET without id', async () => {
        const event = {
            httpMethod: 'GET',
            headers: {},
            body: null,
            queryStringParameters: {},
        } as any;

        const result = await handler(event, {} as any);
        expect(result!.statusCode).toBe(400);
    });

    it('returns 404 for GET with non-existent id', async () => {
        const event = {
            httpMethod: 'GET',
            headers: {},
            body: null,
            queryStringParameters: { id: 'nonexistent' },
        } as any;

        const result = await handler(event, {} as any);
        expect(result!.statusCode).toBe(404);
    });

    it('returns 405 for unsupported methods', async () => {
        const event = {
            httpMethod: 'PUT',
            headers: {},
            body: null,
            queryStringParameters: null,
        } as any;

        const result = await handler(event, {} as any);
        expect(result!.statusCode).toBe(405);
    });

    it('stores and retrieves a report', async () => {
        const postEvent = {
            httpMethod: 'POST',
            headers: {},
            body: JSON.stringify({ id: 'roundtrip', title: 'Test', items: [{ text: 'item1' }] }),
            queryStringParameters: null,
        } as any;

        await handler(postEvent, {} as any);

        const getEvent = {
            httpMethod: 'GET',
            headers: {},
            body: null,
            queryStringParameters: { id: 'roundtrip' },
        } as any;

        const result = await handler(getEvent, {} as any);
        expect(result!.statusCode).toBe(200);
        const body = JSON.parse(result!.body!);
        expect(body.title).toBe('Test');
        expect(body.items).toEqual([{ text: 'item1' }]);
        // ID should not be stored in the data
        expect(body.id).toBeUndefined();
    });
});
