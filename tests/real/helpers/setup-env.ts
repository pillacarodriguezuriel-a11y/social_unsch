import { TEST_DATABASE_URL, TEST_REDIS_URL, generateEphemeralRsaKeys } from './test-environment';

// Configuración de entorno de pruebas reales antes de cualquier carga de módulos
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.REDIS_URL = TEST_REDIS_URL;

// Generar claves RSA reales efímeras para pruebas de JWT
const keys = generateEphemeralRsaKeys();
process.env.JWT_PRIVATE_KEY = keys.privateKey;
process.env.JWT_PUBLIC_KEY = keys.publicKey;
