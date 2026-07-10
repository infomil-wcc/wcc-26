# IML Football App

This project is a modern football predictions and tournament tracking application built with **Angular 22** and **Tailwind CSS**. It incorporates Server-Side Rendering (SSR) via an **Express API** and enforces strict component-based architecture for maintainability.

## 🏗 Architecture & Stack

- **Frontend Framework**: [Angular](https://angular.dev/) v22
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) v3.4 (Utility-first CSS framework for custom responsive designs)
- **UI Library**: Custom Tailwind CSS implementation (Pure Tailwind Design System)
- **Backend/SSR API**: Node.js & Express v4 (Custom Express server running alongside Angular Universal for Server-Side Rendering)
- **State Management**: Angular Signals & RxJS

## 🧩 Component Architecture

The project strictly follows a scalable **Smart/Dummy (Container/Presentational)** component architecture combined with the **Facade** pattern to maximize reusability and separation of concerns.

### Architectural Patterns
- **Smart Components (Containers)**: Typically located in `src/app/features/`, these components handle routing, manage state, and interact with Facades. They pass data down to Dummy components and react to their events.
- **Dummy Components (Presentational)**: Found primarily in `src/app/shared/components/`, these are pure UI components. They receive data via inputs, emit events via outputs, and have no direct dependencies on services or backend state.
- **Facades**: Located in `src/app/core/services/`, Facades abstract the complexity of state management (Signals/RxJS) and API calls. They expose a clean, simplified API for Smart components to consume, keeping components logic-less.
- **Utils**: Pure, isolated functions used for data transformation, formatting, or complex calculations. Because they don't rely on Angular's Dependency Injection, they are highly testable and reusable across the app.

### Shared UI Components
Key UI building blocks are located in `src/app/shared/components/`:
- **Layout & Structure**: `layout`, `nav`, `menu`, `footer`, `hero`, `breadcrumb`
- **Feedback & Interaction**: `dialog`, `loader`, `number-input`, `win-draw`
- **Feature Specific**: `match`, `match-list`, `tactical-lineup`, `team-performance`, `login`

*Note: All custom UI components are designed utilizing pure Tailwind CSS utility classes to adhere to a unified design system without relying on scattered `.scss` files.*

## 🧪 Testing Suites

This application relies on modern, fast testing frameworks:
- **Unit Testing**: [Vitest](https://vitest.dev/) (Replaced Karma/Jasmine). Run with `npm run test`.
- **End-to-End (E2E) Testing**: [Playwright](https://playwright.dev/). Run with `npm run test:e2e` (or `test:e2e:ui` for visual debugging).

## 🚀 Development Server

To run the application locally with both the frontend client and the Express backend API:

```bash
npm run dev
```

Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

To test the Server-Side Rendered (SSR) build locally:

```bash
npm run dev:ssr
```

## 🛠 Code Scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## 📦 Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. For production deployment or specific environments, use:
- `npm run build-prod` (Builds with `/wcc-26/` base href)
- `npm run build-cloud` (Builds with `/browser/` base href)

## 💡 Further Help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.dev/cli) page.
