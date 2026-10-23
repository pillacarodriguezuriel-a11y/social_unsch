import { Request, Response } from 'express';
import { createRadarAuthGuard } from '../../src/middlewares/auth.middleware';
import { generateTestToken, getTestRsaKeys } from '../helpers/test-keys';

describe('apps/radar - createRadarAuthGuard', () => {
  const { publicKey } = getTestRsaKeys();
  const authGuard = createRadarAuthGuard({ jwtPublicKey: publicKey });

  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      locals: {},
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('rechaza solicitudes sin cabecera Authorization con 401 ERR_AUTH_TOKEN_MISSING', () => {
    authGuard(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: true, code: 'ERR_AUTH_TOKEN_MISSING' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rechaza formatos que no sean Bearer <token> con 401 ERR_AUTH_INVALID_TOKEN', () => {
    req.headers = { authorization: 'Basic dXNlcjpwYXNz' };
    authGuard(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: true, code: 'ERR_AUTH_INVALID_TOKEN' })
    );
  });

  it('rechaza tokens expirados con 401 ERR_AUTH_TOKEN_EXPIRED', () => {
    const expiredToken = generateTestToken({ user_id: 'user-1' }, -10); // Expirado hace 10s
    req.headers = { authorization: `Bearer ${expiredToken}` };

    authGuard(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: true, code: 'ERR_AUTH_TOKEN_EXPIRED' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rechaza tokens con firma inválida o manipulada con 401 ERR_AUTH_INVALID_TOKEN', () => {
    const validToken = generateTestToken({ user_id: 'user-1' });
    const tampered = validToken.slice(0, -6) + 'abcdef';
    req.headers = { authorization: `Bearer ${tampered}` };

    authGuard(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: true, code: 'ERR_AUTH_INVALID_TOKEN' })
    );
  });

  it('rechaza token decodificado sin user_id válido con 401 ERR_AUTH_INVALID_TOKEN', () => {
    const { privateKey } = getTestRsaKeys();
    const tokenNoUserId = require('jsonwebtoken').sign({ other: 'value' }, privateKey, { algorithm: 'RS256' });
    req.headers = { authorization: `Bearer ${tokenNoUserId}` };

    authGuard(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ERR_AUTH_INVALID_TOKEN' })
    );
  });

  it('adjunta req.user derivado exclusivamente de la firma del token y llama a next()', () => {
    const token = generateTestToken({ user_id: 'usuario-legitimo-123', role: 'student' });
    req.headers = { authorization: `Bearer ${token}` };

    authGuard(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({
      userId: 'usuario-legitimo-123',
      role: 'student',
    });
  });

  it('rechaza suplantación de identidad ignorando cabeceras x-user-id o x-role enviadas en la petición', () => {
    const token = generateTestToken({ user_id: 'usuario-real-999', role: 'student' });
    req.headers = {
      authorization: `Bearer ${token}`,
      'x-user-id': 'atacante-admin',
      'x-role': 'administrator',
    };

    authGuard(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user?.userId).toBe('usuario-real-999');
    expect(req.user?.role).toBe('student');
    expect(req.user?.userId).not.toBe('atacante-admin');
  });
});
