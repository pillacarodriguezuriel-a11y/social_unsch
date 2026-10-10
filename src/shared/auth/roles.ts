import { AppError } from '../errors/AppError';

/**
 * Roles permitidos en la base de datos de SOCIAL-UNSCH.
 */
export const ALL_ROLES = ['student', 'alumnus', 'professor', 'administrator'] as const;
export type UserRole = typeof ALL_ROLES[number];

/**
 * Roles permitidos para el auto-registro público.
 *
 * El rol 'administrator' está estrictamente prohibido en el registro público.
 * Las cuentas administrativas no pueden ser autoasignadas; deben ser aprovisionadas
 * por procedimientos de gobernanza internos de la institución.
 *
 * Nota sobre roles públicos:
 * - 'student': Estudiante regular de la UNSCH.
 * - 'professor': Declaración jurada del usuario como docente (no validado contra escalafón en esta fase).
 * - 'alumnus': Declaración jurada del usuario como egresado (no validado contra registro SUNEDU en esta fase).
 *
 * La validación de dominio '@unsch.edu.pe' restringe sintácticamente la pertenencia a la universidad,
 * pero no constituye una prueba criptográfica de propiedad del buzón hasta la implementación
 * de verificación por enlace/código (OTP) en fases posteriores.
 */
export const PUBLIC_REGISTRATION_ROLES = ['student', 'alumnus', 'professor'] as const;
export type PublicRegistrationRole = typeof PUBLIC_REGISTRATION_ROLES[number];

/**
 * Verifica si un rol dado es válido para el registro público.
 */
export function isPublicRegistrationRole(role: string): role is PublicRegistrationRole {
  return (PUBLIC_REGISTRATION_ROLES as readonly string[]).includes(role);
}

/**
 * Aplica la política centralizada de autorización de roles para el registro.
 * Lanza un AppError 403 o 400 si el rol no es admisible para registro público.
 */
export function assertPublicRegistrationRole(role: string): asserts role is PublicRegistrationRole {
  if (role === 'administrator') {
    throw new AppError(
      'El rol de administrador no puede ser autoasignado a través del registro público.',
      403,
      'ERR_AUTH_FORBIDDEN_ROLE'
    );
  }

  if (!isPublicRegistrationRole(role)) {
    throw new AppError(
      `El rol '${role}' no es válido para el registro en la plataforma. Roles permitidos: ${PUBLIC_REGISTRATION_ROLES.join(', ')}.`,
      400,
      'ERR_AUTH_INVALID_ROLE'
    );
  }
}
