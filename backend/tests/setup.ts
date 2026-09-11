import Decimal from 'decimal.js';
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });
process.env.TZ = 'Europe/Brussels';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-kredit-32-chars-long';
process.env.API_URL = process.env.API_URL || 'http://localhost:3001';
process.env.FRONT_URL = process.env.FRONT_URL || 'http://localhost:3000';

// Suppress Nest logger noise in tests
if (process.env.CI !== 'true') {
  // keep logs for debugging locally
}

// Default timeout handled in jest.config.js
