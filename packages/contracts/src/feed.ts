import { z } from 'zod';

/**
 * Contrato HTTP de Feed (/api/v1/feed), extraído del comportamiento implementado.
 *
 * Es la definición común a los dos modos soportados: el router local de
 * `apps/api` y el servicio independiente `apps/feed` tras el proxy. Las pruebas
 * de contrato comprueban las respuestas de ambos contra estos esquemas, de modo
 * que activar `FEED_MODE=proxy` no puede cambiar lo que ve el cliente.
 *
 * No contiene lógica de persistencia: la comparten vía `@social-unsch/feed-domain`.
 */

export const FEED_BASE_PATH = '/api/v1/feed';

export const FEED_ROUTES = {
  list: { method: 'GET', path: FEED_BASE_PATH },
  create: { method: 'POST', path: FEED_BASE_PATH },
} as const;

/** Longitud máxima del contenido de una publicación. */
export const FEED_CONTENT_MAX_LENGTH = 2000;
/** Publicaciones por página: valor por defecto y techo que aplica el dominio. */
export const FEED_DEFAULT_LIMIT = 20;
export const FEED_MAX_LIMIT = 50;

/**
 * Parámetros de consulta de GET /api/v1/feed.
 *
 * Llegan como texto. Un valor presente y no numérico produce 400
 * `ERR_VALIDATION_INVALID_FIELDS`; un valor vacío se trata como ausente.
 * `page` y `limit` se acotan en el dominio (página mínima 1, límite 1..50) en
 * lugar de rechazarse.
 */
export const FeedListQuerySchema = z
  .object({
    faculty_id: z.string().optional(),
    school_id: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  })
  .strict();
export type FeedListQuery = z.infer<typeof FeedListQuerySchema>;

/**
 * Cuerpo de POST /api/v1/feed.
 *
 * `content` debe enviarse como texto: ausente o en blanco produce 400; un
 * `content` no textual (por ejemplo numérico) produce hoy un 500. Es
 * comportamiento existente, no una garantía del contrato.
 */
export const FeedCreateRequestSchema = z.object({
  content: z.string().min(1),
  faculty_id: z.union([z.number(), z.string()]).nullish(),
  school_id: z.union([z.number(), z.string()]).nullish(),
});
export type FeedCreateRequest = z.infer<typeof FeedCreateRequestSchema>;

/**
 * Publicación tal como la devuelve la API.
 *
 * `created_at` viaja como texto ISO 8601 en JSON aunque el dominio la maneje
 * como fecha. `author_name` y `author_role` provienen del JOIN con `users`
 * (dependencia documentada mientras PostgreSQL sea compartido) y son cadena
 * vacía si el autor ya no existe.
 */
export const FeedPostSchema = z
  .object({
    id: z.string().min(1),
    user_id: z.string().min(1),
    faculty_id: z.number().int().nullable(),
    professional_school_id: z.number().int().nullable(),
    content: z.string(),
    is_visible: z.boolean(),
    created_at: z.string(),
    author_name: z.string(),
    author_role: z.string(),
  })
  .strict();
export type FeedPost = z.infer<typeof FeedPostSchema>;

/** Respuesta 200 de GET /api/v1/feed. */
export const FeedListResponseSchema = z
  .object({
    data: z.array(FeedPostSchema),
  })
  .strict();
export type FeedListResponse = z.infer<typeof FeedListResponseSchema>;

/** Respuesta 201 de POST /api/v1/feed. */
export const FeedCreateResponseSchema = z
  .object({
    success: z.literal(true),
    message: z.string().min(1),
    post_id: z.string().min(1),
  })
  .strict();
export type FeedCreateResponse = z.infer<typeof FeedCreateResponseSchema>;

/** Códigos de error que pueden devolver las rutas de Feed, con su estado HTTP. */
export const FEED_ERROR_CODES = {
  ERR_AUTH_TOKEN_MISSING: 401,
  ERR_AUTH_INVALID_TOKEN: 401,
  ERR_AUTH_TOKEN_EXPIRED: 401,
  ERR_AUTH_UNAUTHORIZED: 401,
  ERR_VALIDATION_INVALID_FIELDS: 400,
  ERR_NOT_FOUND: 404,
  ERR_SERVER_INTERNAL_ERROR: 500,
  // Solo en modo proxy (desactivado por defecto)
  ERR_FEED_UPSTREAM_UNAVAILABLE: 502,
  ERR_FEED_UPSTREAM_TIMEOUT: 504,
} as const;
export type FeedErrorCode = keyof typeof FEED_ERROR_CODES;
