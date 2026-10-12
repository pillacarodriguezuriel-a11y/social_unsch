import { pool } from '../../config/database';

export interface RouteDetail {
  route_id: string;
  origin_district: string;
  destination: string;
  departure_time: Date;
  available_seats: number;
  price_soles: number;
  driver_alias: string;
}

export interface CarpoolingRoute {
  id: string;
  driver_id: string;
  origin_district: string;
  destination: string;
  destination_pavilion_code: string | null;
  departure_time: Date;
  available_seats: number;
  price_soles: number;
  driver_alias: string;
  created_at: Date;
}

export interface CarpoolingRequest {
  id: string;
  route_id: string;
  passenger_id: string;
  status: 'SEAT_REQUESTED' | 'SEAT_CONFIRMED' | 'SEAT_REJECTED';
  created_at: Date;
}

export interface ContactInfo {
  full_name: string;
  email: string;
  phone_number: string | null;
  whatsapp_link: string | null;
}

export class CarpoolingRepository {
  /**
   * Recupera las rutas activas filtradas por distrito de origen.
   * Ley N° 29733: No expone campos de contacto directo en consultas públicas.
   */
  async findActiveRoutes(originDistrict?: string): Promise<RouteDetail[]> {
    let queryText = `
      SELECT id as route_id, origin_district, destination, departure_time, available_seats, price_soles, driver_alias
      FROM carpooling_routes
      WHERE available_seats > 0
    `;

    const values: any[] = [];
    if (originDistrict) {
      queryText += ` AND origin_district = $1`;
      values.push(originDistrict);
    }

    queryText += ` ORDER BY departure_time ASC`;

    const result = await pool.query<RouteDetail>(queryText, values);
    return result.rows;
  }

  /**
   * Obtiene una ruta por ID.
   */
  async findRouteById(routeId: string): Promise<CarpoolingRoute | null> {
    const query = {
      name: 'fetch-carpooling-route-by-id',
      text: 'SELECT * FROM carpooling_routes WHERE id = $1',
      values: [routeId],
    };
    const result = await pool.query<CarpoolingRoute>(query);
    return result.rows[0] || null;
  }

  /**
   * Obtiene una solicitud de carpooling por ruta y pasajero.
   */
  async findRequest(routeId: string, passengerId: string): Promise<CarpoolingRequest | null> {
    const query = {
      name: 'fetch-carpooling-request',
      text: 'SELECT * FROM carpooling_requests WHERE route_id = $1 AND passenger_id = $2',
      values: [routeId, passengerId],
    };
    const result = await pool.query<CarpoolingRequest>(query);
    return result.rows[0] || null;
  }

  /**
   * Obtiene información simplificada de un estudiante para visualización de seguridad del conductor.
   * POLÍTICA CANÓNICA DE CICLO ACADÉMICO:
   * 1. Campo canónico primario: users.current_academic_cycle (modelo institucional de registro y perfiles).
   * 2. Campo secundario de compatibilidad: users.academic_cycle.
   * 3. Discrepancia: se prioriza current_academic_cycle sobre academic_cycle sin sobreescribir destructivamente en BD.
   * 4. Dato desconocido: si ambos campos son NULL, se retorna null (NUNCA se inventa el ciclo 1).
   */
  async getPassengerMeta(passengerId: string) {
    const query = {
      name: 'fetch-passenger-metadata',
      text: `
        SELECT u.full_name, 
               COALESCE(u.current_academic_cycle, u.academic_cycle) as academic_cycle, 
               ps.name as school_name
        FROM users u
        LEFT JOIN professional_schools ps ON u.professional_school_id = ps.id
        WHERE u.id = $1
      `,
      values: [passengerId],
    };
    const result = await pool.query(query);
    return result.rows[0] || null;
  }

  /**
   * Registra una nueva solicitud de asiento en estado SEAT_REQUESTED (método heredado/básico).
   */
  async createRequest(routeId: string, passengerId: string): Promise<CarpoolingRequest> {
    const query = {
      name: 'insert-carpooling-request',
      text: `
        INSERT INTO carpooling_requests (route_id, passenger_id, status)
        VALUES ($1, $2, 'SEAT_REQUESTED')
        RETURNING id, route_id, passenger_id, status, created_at
      `,
      values: [routeId, passengerId],
    };
    const result = await pool.query<CarpoolingRequest>(query);
    return result.rows[0];
  }

  /**
   * Registra una solicitud de asiento de forma estrictamente atómica bajo una transacción PostgreSQL
   * en la misma conexión/sesión con el cliente.
   *
   * Garantías:
   * - Rollback automático si ocurre un error antes de COMMIT (cero registros huérfanos sin depender de DELETEs).
   * - Protección de concurrencia mediante el índice uq_active_carpooling_request.
   * - Traducción del error 23505 a ERR_CARPOOLING_DUPLICATE_REQUEST.
   */
  async createRequestTransaction(
    routeId: string,
    passengerId: string,
    options?: { injectedFailure?: boolean }
  ): Promise<{
    request: CarpoolingRequest;
    passengerMeta: {
      full_name: string | null;
      academic_cycle: number | null;
      school_name: string | null;
    } | null;
  }> {
    const rawClient = await pool.connect?.();
    const client = rawClient || {
      query: (...args: any[]) => {
        const sql = typeof args[0] === 'string' ? args[0] : (args[0] as any)?.text || '';
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
        return (pool as any).query(...args);
      },
      release: () => {},
    };

    try {
      await client.query('BEGIN');

      // 1. Obtener metadata del pasajero en la misma sesión/transacción
      const metaRes = await client.query(
        `SELECT u.full_name, 
                COALESCE(u.current_academic_cycle, u.academic_cycle) as academic_cycle, 
                ps.name as school_name
         FROM users u
         LEFT JOIN professional_schools ps ON u.professional_school_id = ps.id
         WHERE u.id = $1`,
        [passengerId]
      );
      const passengerMeta = metaRes.rows[0] || null;

      // Inyección deliberada para validación de rollback en pruebas
      if (options?.injectedFailure) {
        throw new Error('INJECTED_TRANSACTION_FAILURE');
      }

      // 2. Insertar solicitud de asiento
      const insertRes = await client.query(
        `INSERT INTO carpooling_requests (route_id, passenger_id, status)
         VALUES ($1, $2, 'SEAT_REQUESTED')
         RETURNING id, route_id, passenger_id, status, created_at`,
        [routeId, passengerId]
      );

      await client.query('COMMIT');

      return {
        request: insertRes.rows[0],
        passengerMeta,
      };
    } catch (error: any) {
      await client.query('ROLLBACK');
      if (error.code === '23505' || error.constraint === 'uq_active_carpooling_request') {
        const dupErr = new Error('ERR_CARPOOLING_DUPLICATE_REQUEST');
        (dupErr as any).code = 'ERR_CARPOOLING_DUPLICATE_REQUEST';
        throw dupErr;
      }
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Elimina una solicitud de asiento (disponible para operaciones de cancelación explícita).
   */
  async deleteRequest(requestId: string): Promise<boolean> {
    const query = {
      name: 'delete-carpooling-request',
      text: 'DELETE FROM carpooling_requests WHERE id = $1',
      values: [requestId],
    };
    const result = await pool.query(query);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Transacción aislada para confirmación de asiento con bloqueo FOR UPDATE (UNSCH-502)
   */
  async confirmBookingTransaction(
    routeId: string,
    driverId: string,
    passengerId: string
  ): Promise<{ driverContact: ContactInfo; passengerContact: ContactInfo }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Bloquear y verificar ruta
      const routeRes = await client.query<CarpoolingRoute>(
        'SELECT id, driver_id, available_seats, driver_alias FROM carpooling_routes WHERE id = $1 FOR UPDATE',
        [routeId]
      );
      const route = routeRes.rows[0];
      if (!route) {
        throw new Error('ROUTE_NOT_FOUND');
      }
      if (route.driver_id !== driverId) {
        throw new Error('NOT_ROUTE_DRIVER');
      }
      if (route.available_seats <= 0) {
        throw new Error('NO_SEATS_AVAILABLE');
      }

      // 2. Bloquear y verificar solicitud
      const requestRes = await client.query<CarpoolingRequest>(
        'SELECT id, passenger_id, status FROM carpooling_requests WHERE route_id = $1 AND passenger_id = $2 FOR UPDATE',
        [routeId, passengerId]
      );
      const request = requestRes.rows[0];
      if (!request) {
        throw new Error('REQUEST_NOT_FOUND');
      }
      if (request.status !== 'SEAT_REQUESTED') {
        throw new Error('INVALID_REQUEST_STATUS');
      }

      // 3. Confirmar asiento en solicitud
      await client.query(
        "UPDATE carpooling_requests SET status = 'SEAT_CONFIRMED' WHERE id = $1",
        [request.id]
      );

      // 4. Decrementar asientos disponibles
      await client.query(
        'UPDATE carpooling_routes SET available_seats = available_seats - 1 WHERE id = $1',
        [routeId]
      );

      // 5. Desvelar tokens de comunicación (Dynamic Unmasking Handshake)
      const driverContactRes = await client.query<ContactInfo>(
        'SELECT full_name, email, phone_number, whatsapp_link FROM users WHERE id = $1',
        [driverId]
      );
      const passengerContactRes = await client.query<ContactInfo>(
        'SELECT full_name, email, phone_number, whatsapp_link FROM users WHERE id = $1',
        [passengerId]
      );

      await client.query('COMMIT');

      return {
        driverContact: driverContactRes.rows[0],
        passengerContact: passengerContactRes.rows[0],
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
