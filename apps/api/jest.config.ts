import type { Config } from 'jest';

const config: Config = {
  // Use ts-jest transformer explicitly (replaces deprecated 'preset' + 'globals' pattern)
  testEnvironment: 'node',
  // El contrato se prueba desde su código fuente; no hace falta compilarlo antes.
  moduleNameMapper: {
    '^@social-unsch/contracts$': '<rootDir>/../../packages/contracts/src/index.ts',
  },


  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // Point to the Jest-specific tsconfig that includes both 'node' and 'jest' in types
        tsconfig: 'tsconfig.jest.json',
        // Required for Node16 module resolution in ts-jest
        isolatedModules: true,
      },
    ],
  },

  // Pruebas unitarias, de rutas con dobles y de contrato (las reales usan jest.real.config.ts)
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.ts',
    '<rootDir>/tests/integration/**/*.test.ts',
    '<rootDir>/tests/contract/**/*.test.ts',
  ],

  // Collect coverage from all application source modules.
  // jwt.ts is excluded because it requires live RSA private/public keys to execute.
  // config files (database, redis) are excluded as they are fully mocked in every test.
  collectCoverageFrom: [
    'src/modules/auth/auth.service.ts',
    'src/modules/auth/auth.repository.ts',
    'src/modules/auth/auth.controller.ts',
    'src/modules/auth/auth.validators.ts',
    'src/modules/users/users.service.ts',
    'src/modules/users/users.repository.ts',
    'src/modules/users/users.controller.ts',
    'src/modules/feed/feed.service.ts',
    'src/modules/feed/feed.repository.ts',
    'src/modules/feed/feed.controller.ts',
    'src/modules/matchmaking/matchmaking.service.ts',
    'src/modules/matchmaking/matchmaking.repository.ts',
    'src/modules/matchmaking/matchmaking.controller.ts',
    'src/modules/carpooling/carpooling.service.ts',
    'src/modules/carpooling/carpooling.repository.ts',
    'src/modules/carpooling/carpooling.controller.ts',
    'src/modules/radar/radar.service.ts',
    'src/modules/radar/radar.repository.ts',
    'src/modules/radar/radar.controller.ts',
    'src/modules/catalogs/catalogs.controller.ts',
    // Etapa 3: composición, arranque, configuración, salud y montaje de Radar
    'src/app.ts',
    'src/bootstrap.ts',
    'src/composition.ts',
    'src/config/env.ts',
    'src/health/health.routes.ts',
    'src/modules/radar/radar.module.ts',
    'src/modules/radar/radar.proxy.ts',
    'src/modules/radar/radar.routes.ts',
    'src/middlewares/auth.middleware.ts',
    'src/middlewares/error.middleware.ts',
    'src/shared/errors/AppError.ts',
  ],

  // Enforce strict >=90% gate across all four coverage axes.
  // Jest will exit with a non-zero status code if any axis falls below this threshold,
  // blocking CI/CD pipelines automatically.
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },

  // Output directory for HTML/lcov reports
  coverageDirectory: 'coverage',

  // Reporters: text for terminal output, lcov for CI badge integration
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],

  // Clear mocks automatically between every test to prevent state leakage
  clearMocks: true,
  restoreMocks: true,

  verbose: true,
};

export default config;

