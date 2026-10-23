import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  // El contrato se prueba desde su código fuente; no hace falta compilarlo antes.
  moduleNameMapper: {
    '^@social-unsch/contracts$': '<rootDir>/../../packages/contracts/src/index.ts',
  },


  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.jest.json',
        isolatedModules: true,
      },
    ],
  },

  testMatch: [
    '<rootDir>/tests/real/**/*.real.test.ts',
  ],

  setupFiles: ['<rootDir>/tests/real/helpers/setup-env.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/real/helpers/after-env.ts'],
  globalSetup: '<rootDir>/tests/real/helpers/global-setup.ts',
  globalTeardown: '<rootDir>/tests/real/helpers/global-teardown.ts',

  // Timeout generoso para pruebas con contenedores reales y transacciones
  testTimeout: 60000,

  verbose: true,
  // Forzar salida secuencial para garantizar aislamiento en base de datos real
  maxWorkers: 1,
};

export default config;
