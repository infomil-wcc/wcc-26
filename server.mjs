import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { readdir } from 'fs/promises';
import dotenv from 'dotenv';
import indexHandler from './api/index.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// --- UPDATED CORS CONFIGURATION ---
// origin: true dynamically reflects the incoming request's Origin header.
// This means it will automatically accept your production URL, localhost, 
// AND any temporary Vercel preview URLs (like wcc-26-git-dev...).
// credentials: true allows cookies/auth headers if your Angular app uses them.
app.use(cors({
  origin: true,
  credentials: true
}));

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the 'data' directory
app.use('/data', express.static(path.join(__dirname, 'data')));

async function loadApiRoutes() {
  const apiDirectory = path.join(__dirname, 'api');
  const apiFiles = await readdir(apiDirectory);

  for (const file of apiFiles) {
    // 1. Skip index.js inside the loop so we don't double-register it
    if (file === 'index.js' || file === 'index.mjs') continue;

    if (file.endsWith('.mjs')) {
      const apiPath = `/${file.replace('.mjs', '')}`;
      const modulePath = path.join(apiDirectory, file);
      const { default: handler } = await import(pathToFileURL(modulePath).href);

      // Registers standalone files like /api/match-scheduler
      app.all(`/api${apiPath}`, async (req, res) => {
        try { await handler(req, res); } catch (error) { res.status(500).json({ error: 'Internal Error' }); }
      });
      console.log(`API route registered: /api${apiPath}`);
    }
  }

  // 2. Map all other /api/* requests directly to your central itty-router entrypoint
  app.all('/api/*', async (req, res) => {
    try {
      await indexHandler(req, res);
    } catch (error) {
      console.error(`Error in central /api rewrite handler:`, error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  console.log(`Catch-all API rewrite registered: /api/*splat -> index.js`);
}

loadApiRoutes().then(() => {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    console.log(`Access API at http://localhost:${port}/api/<route-name>`);
  });
}).catch(error => {
  console.error('Failed to load API routes:', error);
  process.exit(1);
});