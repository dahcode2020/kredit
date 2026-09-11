process.env.TZ = 'Europe/Brussels';

try { require('whatwg-fetch'); } catch {}

// Mock next/navigation, next-intl if needed
try {
  jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
    usePathname: () => '/fr',
    useSearchParams: () => new URLSearchParams(),
  }));
} catch {}

// Mock matchMedia for PWA tests
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

if (typeof window !== 'undefined' && window.navigator) {
  try {
    Object.defineProperty(window.navigator, 'serviceWorker', {
      writable: true,
      value: {
        register: jest.fn().mockResolvedValue({ active: { state: 'activated' }, installing: null }),
        controller: { state: 'activated' },
        ready: Promise.resolve({ active: { state: 'activated' } }),
      },
    } as any);
  } catch {}
}
