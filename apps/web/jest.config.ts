import type { Config } from 'jest';

// Pruebas del frontend limitadas a lógica sin interfaz (app/lib). No hay pruebas de componentes.
const config: Config = {
  testEnvironment: 'node',
  // El contrato se prueba desde su código fuente; no hace falta compilarlo antes.
  moduleNameMapper: {
    '^@social-unsch/contracts$': '<rootDir>/../../packages/contracts/src/index.ts',
  },

  transform: {
    '^.+\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json', isolatedModules: true }],
  },
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  clearMocks: true,
  restoreMocks: true,
};

export default config;
