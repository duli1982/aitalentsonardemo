import type { IncomingMessage, ServerResponse } from 'node:http';

type NodeHandler = (req: IncomingMessage, res: ServerResponse) => Promise<unknown> | unknown;

/**
 * Keeps the local Vite middleware's Node request/response contract while also
 * supporting Vercel's current Web Request handler contract.
 */
export function universalHandler(handler: NodeHandler) {
  return async function handle(req: IncomingMessage | Request, res?: ServerResponse): Promise<unknown> {
    if (res) return handler(req as IncomingMessage, res);

    const request = req as Request;
    const url = new URL(request.url);
    const requestBody = request.body ? Buffer.from(await request.arrayBuffer()) : Buffer.alloc(0);
    const headers = Object.fromEntries(Array.from(request.headers.entries()).map(([key, value]) => [key.toLowerCase(), value]));
    const nodeRequest = {
      method: request.method,
      url: `${url.pathname}${url.search}`,
      headers,
      async *[Symbol.asyncIterator]() {
        if (requestBody.length) yield requestBody;
      },
    } as unknown as IncomingMessage;

    let statusCode = 200;
    let responseBody = '';
    const responseHeaders = new Headers();
    const nodeResponse = {
      get statusCode() { return statusCode; },
      set statusCode(value: number) { statusCode = value; },
      setHeader(name: string, value: number | string | readonly string[]) {
        responseHeaders.set(name, Array.isArray(value) ? value.join(', ') : String(value));
        return this;
      },
      end(chunk?: unknown) {
        if (chunk !== undefined && chunk !== null) responseBody += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
        return this;
      },
    } as unknown as ServerResponse;

    await handler(nodeRequest, nodeResponse);
    return new Response(responseBody || null, { status: statusCode, headers: responseHeaders });
  };
}
