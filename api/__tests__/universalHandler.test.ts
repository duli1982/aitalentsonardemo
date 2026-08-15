import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import { universalHandler } from '../_lib/universalHandler';

describe('universalHandler', () => {
  it('adapts Vercel Web Requests to existing Node-style handlers', async () => {
    const handler = universalHandler(async (req: IncomingMessage, res: ServerResponse) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      res.statusCode = 201;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ method: req.method, url: req.url, body: Buffer.concat(chunks).toString('utf8'), organization: req.headers['x-organization'] }));
    });

    const result = await handler(new Request('https://example.test/api/example?scope=admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Organization': 'local-workspace' },
      body: JSON.stringify({ ok: true }),
    })) as Response;

    expect(result.status).toBe(201);
    expect(result.headers.get('content-type')).toBe('application/json');
    await expect(result.json()).resolves.toEqual({
      method: 'POST',
      url: '/api/example?scope=admin',
      body: JSON.stringify({ ok: true }),
      organization: 'local-workspace',
    });
  });
});
