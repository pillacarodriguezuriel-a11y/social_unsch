import { z } from 'zod';

/**
 * Formato único de error de la API (/api/v1). Lo produce errorMiddleware y algunos controladores.
 * `code` es estable y puede usarse en el cliente; `message` es texto para el usuario.
 */
export const ErrorResponseSchema = z
  .object({
    error: z.literal(true),
    message: z.string().min(1),
    code: z.string().regex(/^ERR_[A-Z0-9_]+$/),
  })
  .strict();

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
