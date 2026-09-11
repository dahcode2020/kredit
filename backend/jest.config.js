// KREDIT backend — Jest multi-niveaux
// unit: src unit tests + tests/unit (sans DB)
// integration: tests/integration (PG/Redis via testcontainers si dispo, sinon mocks)
// api: tests/api (supertest si dependances installees, sinon fallback jest simple)
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1', '^src/(.*)$': '<rootDir>/src/$1' },
  globals: { 'ts-jest': { tsconfig: { esModuleInterop: true, allowSyntheticDefaultImports: true, experimentalDecorators: true, emitDecoratorMetadata: true } } },
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.module.ts',
    '!src/**/entities/**',
    '!src/**/*.dto.ts',
    '!src/**/main.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: { branches: 5, functions: 5, lines: 5 },
    './src/credit/**': { branches: 50, functions: 50, lines: 50 },
    './src/common/money/**': { branches: 15, functions: 50, lines: 50 },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 15000,
  verbose: true,
};
