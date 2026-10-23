import crypto from 'crypto';
import jwt from 'jsonwebtoken';

let cachedKeys: { publicKey: string; privateKey: string } | null = null;

export function getTestRsaKeys() {
  if (!cachedKeys) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    cachedKeys = { publicKey, privateKey };
  }
  return cachedKeys;
}

export function generateTestToken(
  payload: { user_id?: string; role?: string; [key: string]: any } = {},
  expiresIn: jwt.SignOptions['expiresIn'] = '1h'
): string {
  const { privateKey } = getTestRsaKeys();
  const defaultPayload = {
    user_id: '550e8400-e29b-41d4-a716-446655440000',
    role: 'student',
    ...payload,
  };
  return jwt.sign(defaultPayload, privateKey, {
    algorithm: 'RS256',
    expiresIn,
  });
}
