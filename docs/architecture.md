# Architecture Overview

The IML Football Challenge application enforces strict separation of concerns through proven Angular architecture patterns. This ensures scalability, maintainability, and code reusability.

## Smart & Dummy Components

### Smart Components (Containers)
- **Location:** Typically found in `src/app/features/`
- **Role:** These act as the orchestrators of a specific feature or page. 
- **Responsibilities:**
    - Managing route states.
    - Injecting and consuming Facade services to retrieve data.
    - Managing high-level component state using Angular Signals.
    - Passing data down to Presentational (Dummy) components via inputs (`@Input()` or `input()`).
    - Reacting to user events emitted by Dummy components and delegating to Facades.

### Dummy Components (Presentational)
- **Location:** Typically found in `src/app/shared/components/`
- **Role:** Pure UI components responsible *only* for displaying data and capturing user interactions.
- **Responsibilities:**
    - Styling and UI layout (using pure Tailwind CSS).
    - Accepting state/data via inputs.
    - Emitting user actions via outputs (`@Output()` or `output()`).
    - **Crucial Rule:** They *never* inject services or interact with APIs directly. This makes them highly reusable and easily testable.

---

## Facade Pattern

- **Location:** Typically found in `src/app/core/services/`
- **Role:** Acts as a middleman between Smart components and the actual API/State management layer.
- **Why?** Instead of components injecting `HttpClient` or dealing with complex RxJS mapping, they inject a Facade. The Facade provides a clean API (often exposing Signals) for components to read data and trigger actions.
- **Benefits:** If the underlying API or state management library changes, the Smart components don't need to be touched. Only the Facade updates.

---

## Utils Pattern

- **Location:** Typically found in `src/app/core/utils/`
- **Role:** Pure, isolated functions for tasks like date formatting, complex point calculations, or string manipulation.
- **Benefits:** Since these are pure JavaScript/TypeScript functions that don't rely on Angular's Dependency Injection (`inject()`), they can be tested independently and reused across services, facades, and components.

---

## Server-Side Rendering (SSR) & Express API

The application uses **Angular Universal (SSR)** tightly integrated with a custom Node.js Express server (`server.mjs` / `server.ts`).

- **Static Assets:** Handled by Express before falling back to the Angular Engine.
- **Routing:** Express catches `**` routes and passes them to the `AngularNodeAppEngine` to render the initial HTML on the server.
- **SEO & Performance:** SSR ensures that first-page loads contain fully populated HTML with meta tags, improving SEO rankings and perceived loading times.
