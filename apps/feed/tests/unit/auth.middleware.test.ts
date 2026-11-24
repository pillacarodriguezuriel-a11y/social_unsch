/**
 * Tests del middleware de autenticación del servicio Feed.
 * Cubre: token ausente, formato inválido, token alterado, token expirado.
 */
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { createFeedAuthGuard } from '../../src/middlewares/auth.middleware';

// Genera un par RS256 efímero para los tests
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

function makeRequest(overrides: Record<string, any> = {}) {
  return {
    headers: {},
    ...overrides,
  } as any;
}

function makeResponse() {
  const res: any = { locals: {} };
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function makeValidToken(payload: Record<string, any> = {}, expiresIn: string = '1h') {
  return jwt.sign({ user_id: 'user-auth-001', role: 'student', ...payload }, privateKey, {
    algorithm: 'RS256',
    expiresIn: expiresIn as any,
  });
}

describe('createFeedAuthGuard', () => {
  const guard = createFeedAuthGuard({ jwtPublicKey: publicKey });

  it('should reject request with no Authorization header', () => {
    const req = makeRequest();
    const res = makeResponse();
    const next = jest.fn();
    guard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ERR_AUTH_TOKEN_MISSING' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject request with malformed Authorization header', () => {
    const req = makeRequest({ headers: { authorization: 'InvalidToken' } });
    const res = makeResponse();
    const next = jest.fn();
    guard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ERR_AUTH_INVALID_TOKEN' }));
  });

  it('should reject request with tampered token', () => {
    const req = makeRequest({ headers: { authorization: 'Bearer tampered.token.here' } });
    const res = makeResponse();
    const next = jest.fn();
    guard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ERR_AUTH_INVALID_TOKEN' }));
  });

  it('should reject expired token', () => {
    const expiredToken = makeValidToken({}, '-1h');
    const req = makeRequest({ headers: { authorization: `Bearer ${expiredToken}` } });
    const res = makeResponse();
    const next = jest.fn();
    guard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ERR_AUTH_TOKEN_EXPIRED' }));
  });

  it('should accept valid token and set req.user from token only', () => {
    const token = makeValidToken({ user_id: 'user-valid-001', role: 'professor' });
    const req = makeRequest({ headers: { authorization: `Bearer ${token}` } });
    const res = makeResponse();
    const next = jest.fn();
    guard(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toMatchObject({ userId: 'user-valid-001', role: 'professor' });
  });

  it('should NOT use x-user-id header to set identity', () => {
    const req = makeRequest({
      headers: {
        authorization: 'Bearer tampered',
        'x-user-id': 'malicious-user',
      },
    });
    const res = makeResponse();
    const next = jest.fn();
    guard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(req.user).toBeUndefined();
  });

  it('should reject token without user_id claim', () => {
    const tokenNoUserId = jwt.sign({ role: 'student' }, privateKey, { algorithm: 'RS256', expiresIn: '1h' });
    const req = makeRequest({ headers: { authorization: `Bearer ${tokenNoUserId}` } });
    const res = makeResponse();
    const next = jest.fn();
    guard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ERR_AUTH_INVALID_TOKEN' }));
  });
});
