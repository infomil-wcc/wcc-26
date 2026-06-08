import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { readdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the 'data' directory
app.use('/data', express.static(path.join(__dirname, 'data')));

// Dynamically load API routes
async function loadApiRoutes() {
  const apiDirectory = path.join(__dirname, 'api');
  const apiFiles = await readdir(apiDirectory);

  for (const file of apiFiles) {
    if (file.endsWith('.mjs')) {
      const apiPath = `/${file.replace('.mjs', '')}`;
      const modulePath = path.join(apiDirectory, file);
      const { default: handler } = await import(pathToFileURL(modulePath).href);

      app.all(`/api${apiPath}`, async (req, res) => {
        // Set CORS headers for preflight requests and actual requests
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          return res.status(200).end();
        }
        
        // The API handlers expect request and response objects.
        // We need to adapt Express's req/res to what the handlers expect.
        // The existing handlers use `request.query` and `request.method`, `request.body`
        // which are directly available on Express's `req` object.
        // They also use `response.status().json()` which is also available on Express's `res`.
        await handler(req, res);
      });
      console.log(`API route registered: /api${apiPath}`);
    }
  }
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
