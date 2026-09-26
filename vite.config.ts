import { defineConfig } from 'vite';
import { resolve } from 'path';
import Ably from 'ably';
import dotenv from 'dotenv';
dotenv.config();

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        play: resolve(__dirname, 'play/index.html'),
      },
    },
  },
  server: {
    port: 3000,
    host: true, // Listen on all addresses for phone testing
  },
  plugins: [
    {
      name: 'configure-server',
      configureServer(server) {
        server.middlewares.use('/api/ably-token', async (req, res, next) => {
          try {
            if (!process.env.ABLY_API_KEY) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'ABLY_API_KEY is not set' }));
              return;
            }
            const client = new Ably.Rest(process.env.ABLY_API_KEY);
            const url = new URL(req.url || '', `http://${req.headers.host}`);
            const clientId = url.searchParams.get('clientId') || 'anonymous';
            
            const tokenRequestData = await client.auth.createTokenRequest({ clientId });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(tokenRequestData));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      }
    }
  ]
});
