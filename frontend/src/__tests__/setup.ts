import '@testing-library/jest-dom';

// jsdom doesn't implement matchMedia — stub it so Zustand theme store works
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Stub clipboard API
Object.defineProperty(navigator, 'clipboard', {
  writable: true,
  value: { writeText: () => Promise.resolve() },
});
