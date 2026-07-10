# Testing

The IML Football Challenge application utilizes modern, fast test runners that replace legacy tools like Karma and Protractor. 

## Unit Testing with Vitest

We have migrated the unit test suite from Karma/Jasmine to **Vitest**. Vitest integrates flawlessly with Vite (which powers the Angular CLI's modern build pipeline) and drastically reduces test execution time.

### Running Unit Tests

To run the entire Vitest suite:
```bash
npm run test
```

### Key Practices
- **Mocks & Spies:** We use `vi.fn()` and `vi.spyOn()` instead of Jasmine's `jasmine.createSpy()`.
- **Component Isolation:** Ensure you mock `ActivatedRoute` and Facade services when testing Smart components.
- **Assertions:** Vitest uses Chai under the hood, meaning syntax is generally `expect(value).toBe(true)` instead of `toBeTrue()`.

## End-to-End (E2E) Testing with Playwright

We utilize **Playwright** for robust browser automation and E2E validation. Playwright ensures the application works as intended across different browser engines (Chromium, Firefox, WebKit).

### Running E2E Tests

To execute tests in headless mode:
```bash
npm run test:e2e
```

To run tests using the interactive Playwright UI (highly recommended for debugging):
```bash
npm run test:e2e:ui
```

To update visual snapshots if UI elements have changed intentionally:
```bash
npm run test:e2e:update
```

### Writing Tests
E2E tests should focus on critical user flows (e.g., logging in, navigating the tournament bracket, submitting a match prediction) rather than granular component logic.
