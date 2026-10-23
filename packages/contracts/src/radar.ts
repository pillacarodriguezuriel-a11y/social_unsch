import { z } from 'zod';

/**
 * Contrato HTTP de Radar (/api/v1/radar), extraído del comportamiento implementado.
 *
 * Es la única definición de los nodos y valores aceptados: la API los usa para validar y las
 * pruebas de contrato los usan para comprobar las respuestas. No contiene lógica de persistencia.
 */

export const RADAR_BASE_PATH = '/api/v1/radar';

export const RADAR_ROUTES = {
  status: { method: 'GET', path: `${RADAR_BASE_PATH}/status` },
  report: { method: 'POST', path: `${RADAR_BASE_PATH}/report` },
} as const;

/** Votos de usuarios distintos necesarios para publicar un estado. */
export const RADAR_VOTE_THRESHOLD = 3;
/** Vigencia, en segundos, de votos y estados publicados (se renueva con cada voto). */
export const RADAR_TTL_SECONDS = 900;
/** Valor devuelto cuando un nodo no tiene estado vigente. */
export const RADAR_UNDEFINED_VALUE = 'indefinido';

export const RADAR_NODES = [
  'comedor',
  'rectorado',
  'biblioteca_floor_1',
  'biblioteca_floor_2',
  'biblioteca_floor_3',
  'biblioteca_floor_4',
  'campus_alert',
] as const;
export type RadarNode = (typeof RADAR_NODES)[number];

// Los valores se aceptan en inglés y en español tal como los admite la API actual.
// Se cuentan como votos distintos; unificarlos es una decisión pendiente (no un cambio de estilo).
export const RADAR_COMEDOR_STATUSES = [
  'fluid', 'medium_queue', 'long_queue', 'closed',
  'Fluido', 'Cola Media', 'Cola Larga', 'Cerrado',
] as const;

export const RADAR_RECTORADO_STATUSES = [
  'empty_window', 'waiting_15', 'collapsed',
  'Ventanilla vacía', 'Espera de 15 min', 'Colapsado',
] as const;

export const RADAR_CAMPUS_ALERT_STATUSES = [
  'class_suspended', 'cultural_event', 'lost_item_dni', 'lost_item_keys', 'lost_item_other',
  'Clase suspendida', 'Evento cultural', 'Pérdida de DNI', 'Pérdida de Llaves', 'Pérdida de objeto',
] as const;

/** Aforo de biblioteca: porcentaje 0..100 enviado como texto (por ejemplo "40"). */
export const RADAR_LIBRARY_OCCUPANCY_MIN = 0;
export const RADAR_LIBRARY_OCCUPANCY_MAX = 100;

/**
 * Cuerpo de POST /api/v1/radar/report.
 * La API exige `node` y `status` no vacíos; valida los valores después (400 con códigos propios).
 * `status` debe enviarse como texto: un número produce hoy un 500 (comportamiento existente).
 */
export const RadarReportRequestSchema = z.object({
  node: z.enum(RADAR_NODES),
  status: z.string().min(1),
});
export type RadarReportRequest = z.infer<typeof RadarReportRequestSchema>;

const nodeStatus = z
  .object({
    status: z.string(),
    is_definite: z.boolean(),
  })
  .strict();

const floorOccupancy = z
  .object({
    occupancy: z.union([z.number(), z.literal(RADAR_UNDEFINED_VALUE)]),
    is_definite: z.boolean(),
  })
  .strict();

/** Respuesta 200 de GET /api/v1/radar/status. */
export const RadarStatusResponseSchema = z
  .object({
    comedor: nodeStatus,
    rectorado: nodeStatus,
    biblioteca: z
      .object({
        floor_1: floorOccupancy,
        floor_2: floorOccupancy,
        floor_3: floorOccupancy,
        floor_4: floorOccupancy,
      })
      .strict(),
    campus_alert: nodeStatus,
  })
  .strict();
export type RadarStatusResponse = z.infer<typeof RadarStatusResponseSchema>;

/** Respuesta 200 de POST /api/v1/radar/report cuando el voto completa el consenso. */
export const RadarReportUpdatedSchema = z
  .object({
    message: z.string(),
    updated: z.literal(true),
    current_status: z.string(),
  })
  .strict();

/** Respuesta 200 de POST /api/v1/radar/report cuando faltan votos (o el voto era repetido). */
export const RadarReportPendingSchema = z
  .object({
    message: z.string(),
    updated: z.literal(false),
    votes_current: z.number().int().min(0),
    votes_required: z.literal(RADAR_VOTE_THRESHOLD),
  })
  .strict();

export const RadarReportResponseSchema = z.discriminatedUnion('updated', [
  RadarReportUpdatedSchema,
  RadarReportPendingSchema,
]);
export type RadarReportResponse = z.infer<typeof RadarReportResponseSchema>;

/** Códigos de error que pueden devolver las rutas de Radar, con su estado HTTP. */
export const RADAR_ERROR_CODES = {
  ERR_AUTH_TOKEN_MISSING: 401,
  ERR_AUTH_INVALID_TOKEN: 401,
  ERR_AUTH_TOKEN_EXPIRED: 401,
  ERR_AUTH_UNAUTHORIZED: 401,
  ERR_VALIDATION_INVALID_FIELDS: 400,
  ERR_RADAR_INVALID_NODE: 400,
  ERR_RADAR_INVALID_STATUS: 400,
  ERR_SERVER_INTERNAL_ERROR: 500,
  // Solo en modo proxy (desactivado por defecto)
  ERR_RADAR_UPSTREAM_UNAVAILABLE: 502,
  ERR_RADAR_UPSTREAM_TIMEOUT: 504,
} as const;
export type RadarErrorCode = keyof typeof RADAR_ERROR_CODES;
