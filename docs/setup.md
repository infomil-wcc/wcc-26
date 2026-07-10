# Setup & Deployment

Follow these instructions to get the IML Football Challenge application running locally.

## Prerequisites
- **Node.js**: Requires a modern LTS version of Node.js.
- **npm**: Comes bundled with Node.js.

## Installation
Clone the repository and install the dependencies:

```bash
npm install
```

## Running the Application

### Local Development (Frontend Only + Hot Reloading)
To run the standard Angular dev server alongside the custom Node Express API backend:

```bash
npm run dev
```
Navigate to `http://localhost:4200/`. The app will automatically reload when source files change. The Express API handles backend logic concurrently.

### Local Development with Server-Side Rendering (SSR)
To test how the application renders on the server (which is vital for SEO and performance):

```bash
npm run dev:ssr
```
This boots up the Angular Universal engine integrated with the Express API server.

## Building for Production

To compile the application into static files and generate the server bundle for production deployment, run one of the following build commands based on your target environment:

### Standard Production Build
Builds the app using a specific base href tailored for standard deployments:
```bash
npm run build-prod
```
Artifacts are generated in the `dist/` directory.

### Cloud Build
Tailored for environments operating from the root `/browser/` path:
```bash
npm run build-cloud
```

## Deployment Considerations
Ensure that your production server executes `server.mjs` (or the compiled output) using Node.js to spin up both the API endpoints and the Server-Side Rendering engine.
