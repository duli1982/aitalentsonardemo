import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import generateHandler from './api/ai/generate';
import embedHandler from './api/ai/embed';
import parseResumeHandler from './api/ai/parse-resume';
import publishingHandler from './api/publishing';
import communicationsHandler from './api/communications';
import communicationWebhookHandler from './api/communication-webhook';
import calendarHandler from './api/calendar';
import conversationPlatformHandler, { runConversationWorker } from './api/conversation-platform';
import conversationWebhookHandler from './api/conversation-webhook';
import careersHandler from './api/careers';

function localAiApi(): Plugin {
  return {
    name: 'talent-sonar-local-ai-api',
    configureServer(server) {
      const route = (path: string, handler: typeof generateHandler) => server.middlewares.use(path, (req, res, next) => { void handler(req, res).catch(next); });
      route('/api/ai/generate', generateHandler);
      route('/api/ai/embed', embedHandler);
      route('/api/ai/parse-resume', parseResumeHandler);
      route('/api/publishing', publishingHandler);
      route('/api/communications', communicationsHandler);
      route('/api/communication-webhook', communicationWebhookHandler);
      route('/api/calendar', calendarHandler);
      route('/api/conversation-platform', conversationPlatformHandler);
      route('/api/conversation-webhook', conversationWebhookHandler);
      route('/api/careers', careersHandler);
      const organizations = (process.env.TALENT_SONAR_WORKER_ORGANIZATIONS || 'local-workspace').split(',').map((item) => item.trim()).filter(Boolean);
      const worker = setInterval(() => { for (const organizationId of organizations) void runConversationWorker(organizationId).catch((error) => server.config.logger.error(`[conversation-worker] ${organizationId}: ${String(error)}`)); }, 60_000);
      server.httpServer?.once('close', () => clearInterval(worker));
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    if (!process.env.GEMINI_API_KEY && env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
    if (!process.env.GOOGLE_API_KEY && env.GOOGLE_API_KEY) process.env.GOOGLE_API_KEY = env.GOOGLE_API_KEY;
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), localAiApi()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
