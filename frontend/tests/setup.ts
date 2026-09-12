process.env.TZ = 'Europe/Brussels';

try { require('whatwg-fetch'); } catch {}

// jsdom ne fournit pas TextEncoder/TextDecoder, dont react-dom/server a besoin
// pour rendre un composant dans un test d'hydratation.
const util = require('util');
if (typeof globalThis.TextEncoder === 'undefined') (globalThis as any).TextEncoder = util.TextEncoder;
if (typeof globalThis.TextDecoder === 'undefined') (globalThis as any).TextDecoder = util.TextDecoder;

// Mock next/navigation, next-intl if needed
try {
  jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
    usePathname: () => '/fr',
    useSearchParams: () => new URLSearchParams(),
  }));
} catch {}

// Mock matchMedia for PWA tests
if (typeof window !== 'undefined') {
  // Defini MEME quand jsdom en fournit un: celui de jsdom est non configurable, et un composant qui
  // lit `prefers-reduced-motion` ne peut alors etre teste dans les deux etats qu'en le remplacant.
  // Le comportement par défaut reste celui de jsdom (`matches: false`), donc les specs PWA existantes
  // ne voient rien changer — seules celles qui posent leur propre `mockImplementation` le peuvent.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
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
      // configurable: les specs qui doivent poser leur propre fake (register/unregister, caches)
      // ne peuvent pas redéfinir une propriété verrouillée en writable seul.
      configurable: true,
      value: {
        register: jest.fn().mockResolvedValue({ active: { state: 'activated' }, installing: null }),
        controller: { state: 'activated' },
        ready: Promise.resolve({ active: { state: 'activated' } }),
      },
    } as any);
  } catch {}
}
