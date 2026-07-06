import { z } from 'zod';

// Expresión regular insensible a mayúsculas/minúsculas para validar el dominio institucional de la UNSCH
export const institutionalEmailRegex = /^[A-Za-z0-9._%+-]+@unsch\.edu\.pe$/i;

/**
 * Esquema de validación para el registro de nuevos usuarios en la plataforma.
 * Implementa de forma estricta las validaciones del backend.
 */
export const registerSchema = z.object({
  full_name: z
    .string({ required_error: 'El nombre completo es requerido.' })
    .min(3, { message: 'El nombre completo debe tener como mínimo 3 caracteres.' })
    .max(200, { message: 'El nombre completo no debe exceder los 200 caracteres.' })
    .regex(/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/, {
      message: 'El nombre completo solo debe contener letras y espacios.',
    }),
  email: z
    .string({ required_error: 'El correo electrónico es requerido.' })
    .regex(institutionalEmailRegex, {
      message: 'El correo electrónico ingresado no pertenece al dominio institucional de la UNSCH (@unsch.edu.pe).',
    }),
  password: z
    .string({ required_error: 'La contraseña es requerida.' })
    .min(8, { message: 'La contraseña debe tener como mínimo 8 caracteres.' })
    .regex(/[A-Z]/, { message: 'La contraseña debe incluir al menos una letra mayúscula.' })
    .regex(/[a-z]/, { message: 'La contraseña debe incluir al menos una letra minúscula.' })
    .regex(/[0-9]/, { message: 'La contraseña debe incluir al menos un número.' })
    .regex(/[^A-Za-z0-9]/, { message: 'La contraseña debe incluir al menos un carácter especial (símbolo).' }),
  role: z.enum(['student', 'alumnus', 'professor', 'administrator'], {
    errorMap: () => ({ message: 'El rol provisto no es válido para la plataforma.' }),
  }),
  professional_school_id: z
    .number()
    .int()
    .positive({ message: 'El identificador de la escuela profesional debe ser un entero positivo.' })
    .optional()
    .nullable(),
  current_academic_cycle: z
    .number()
    .int()
    .min(1, { message: 'El ciclo académico mínimo permitido es 1.' })
    .max(12, { message: 'El ciclo académico máximo permitido es 12.' })
    .optional()
    .nullable(),
});

/**
 * Esquema de validación para el inicio de sesión.
 */
export const loginSchema = z.object({
  email: z
    .string({ required_error: 'El correo electrónico es requerido.' })
    .regex(institutionalEmailRegex, {
      message: 'El correo electrónico ingresado no pertenece al dominio institucional de la UNSCH (@unsch.edu.pe).',
    }),
  password: z
    .string({ required_error: 'La contraseña es requerida.' }),
});
