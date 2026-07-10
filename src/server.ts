import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr/node';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';
import { bootstrapApplication, BootstrapContext } from '@angular/platform-browser';

const bootstrap = (context: BootstrapContext) => bootstrapApplication(AppComponent, config, context);

// The Express app is exported so that it can be used by serverless Functions.
export function app(): express.Express {
  const server = express();
  const serverDistFolder = dirname(fileURLToPath(import.meta.url));
  const browserDistFolder = resolve(serverDistFolder, '../browser');
  const indexHtml = join(serverDistFolder, 'index.server.html');

  const commonEngine = new CommonEngine();

  server.set('view engine', 'html');
  server.set('views', browserDistFolder);

  // Serve static files from /browser (skip for routes handled by Angular)
  server.get(
    '**',
    express.static(browserDistFolder, {
      maxAge: '1y',
      index: false,
    }),
  );

  // All regular routes use the Angular engine
  server.get('**', (req, res, next: any) => {
    const { protocol, originalUrl, baseUrl, headers } = req;

    commonEngine
      .render({
        bootstrap,
        documentFilePath: indexHtml,
        url: `${protocol}://${headers.host}${originalUrl}`,
        publicPath: browserDistFolder,
        providers: [
          { provide: APP_BASE_HREF, useValue: baseUrl }
        ],
      })
      .then((html) => res.send(html))
      .catch((err) => next(err));
  });

  return server;
}

const server = app();

if (process.env['NODE_ENV'] !== 'production' || process.env['PORT']) {
  const port = process.env['PORT'] || 4000;
  server.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export default bootstrap;
