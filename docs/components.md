# Components & Design System

The application uses a Custom Design System built purely on top of **Tailwind CSS**. All shared Presentational (Dummy) components are designed strictly with utility classes to ensure a lightweight footprint, high customizability, and an absence of scattered `.scss` files.

## Philosophy

- **No Component Libraries:** We rely on custom-built Tailwind HTML structures rather than heavy third-party UI libraries like PrimeNG or Angular Material.
- **Utility-First:** All styling is done within the `.html` templates using Tailwind classes (e.g., `flex`, `text-center`, `bg-blue-500`).
- **Responsive by Default:** Mobile-first Tailwind breakpoints (`md:`, `lg:`) handle all responsive logic.

## Shared UI Components

Located in `src/app/shared/components/`, these elements are reused globally across the application.

### Structural Components

- **Layout (`layout`)**: The primary wrapper for the application. It dynamically adjusts its left padding based on the sidebar's collapsed state (`md:pl-[260px]` vs `md:pl-[72px]`).
- **Hero (`hero`)**: A visually striking, top-level banner component. Features an image background with a dark overlay (`bg-black/70`) to ensure text readability.
- **Footer (`footer`)**: The global application footer. It utilizes complex Tailwind background gradients (`bg-[radial-gradient(...)]` and `bg-[linear-gradient(...)]`) to achieve a modern, glowing UI effect without any custom CSS.
- **Breadcrumb (`breadcrumb`)**: A lightweight navigation trail utilizing standard Flexbox and text coloring classes.

### Interactive Components

- **Dialog (`dialog`)**: A highly reusable modal window component. 
    - Uses fixed positioning (`fixed inset-0 z-[1400]`) for the backdrop overlay.
    - Features a custom styled header using background images combined with Tailwind classes.
    - Content is projected securely via Angular's `<ng-content>`.
- **Number Input (`number-input`)**: Custom numeric input fields, heavily styled to match the tournament's modern aesthetic.
- **Win/Draw Indicators (`win-draw`)**: Visual components that indicate match outcomes via distinct color codes.

### Feature-Specific Dummies

- **Match List (`match-list`) & Match (`match`)**: Renders lists of games and their detailed layouts.
- **Tactical Lineup (`tactical-lineup`)**: Renders a visually complex football pitch utilizing grid or absolute positioning classes in Tailwind to position players.
