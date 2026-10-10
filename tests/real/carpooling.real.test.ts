import { Pool } from 'pg';
import { getTestPool } from './helpers/test-environment';
import { runMigrations } from '../../src/database/migrations/migrator';
import { loadCatalogs } from '../../src/database/migrations/load_catalogs';
import { CarpoolingService } from '../../src/modules/carpooling/carpooling.service';
import { CarpoolingRepository } from '../../src/modules/carpooling/carpooling.repository';

describe('Real Carpooling Concurrency & Atomicity (PostgreSQL Real)', () => {
  let pool: Pool;
  let carpoolingService: CarpoolingService;
  let carpoolingRepo: CarpoolingRepository;

  const driverId = '11111111-1111-1111-1111-111111111111';
  const passenger1Id = '22222222-2222-2222-2222-222222222222';
  const passenger2Id = '33333333-3333-3333-3333-333333333333';
  const intruderId = '44444444-4444-4444-4444-444444444444';

  beforeAll(async () => {
    pool = getTestPool();
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await runMigrations(pool);
    await loadCatalogs(pool);

    carpoolingService = new CarpoolingService();
    carpoolingRepo = new CarpoolingRepository();
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    // Limpiar tablas de carpooling y usuarios de prueba
    await pool.query('DELETE FROM carpooling_requests');
    await pool.query('DELETE FROM carpooling_routes');
    await pool.query('DELETE FROM users');

    // Insertar usuarios de prueba
    await pool.query(
      `INSERT INTO users (id, full_name, email, password_hash, role, phone_number, whatsapp_link, professional_school_id, academic_cycle)
       VALUES 
       ($1, 'Profesor Conductor', 'conductor@unsch.edu.pe', '$2b$12$hash1', 'professor', '966000001', 'https://wa.me/51966000001', 20, 10),
       ($2, 'Juan Pasajero Sistemas', 'pasajero1@unsch.edu.pe', '$2b$12$hash2', 'student', '966000002', 'https://wa.me/51966000002', 20, 5),
       ($3, 'Maria Pasajera Minas', 'pasajero2@unsch.edu.pe', '$2b$12$hash3', 'student', '966000003', 'https://wa.me/51966000003', 21, 6),
       ($4, 'Intruso No Autorizado', 'intruso@unsch.edu.pe', '$2b$12$hash4', 'student', '966000004', 'https://wa.me/51966000004', 20, 3)`,
      [driverId, passenger1Id, passenger2Id, intruderId]
    );
  });

  it('Scenario 1: Consulta de metadatos con columnas correctas (professional_school_id y academic_cycle)', async () => {
    // Crear una ruta académica con 2 asientos disponibles
    const routeRes = await pool.query(
      `INSERT INTO carpooling_routes (driver_id, origin_district, destination, departure_time, available_seats, price_soles, driver_alias)
       VALUES ($1, 'San Juan Bautista', 'Campus Central', NOW() + INTERVAL '2 hours', 2, 2.50, 'Ing. Conductor')
       RETURNING id`,
      [driverId]
    );
    const routeId = routeRes.rows[0].id;

    // Solicitar asiento como Pasajero 1
    const booking = await carpoolingService.requestSeat(routeId, passenger1Id);

    expect(booking.request_id).toBeDefined();
    expect(booking.status).toBe('SEAT_REQUESTED');
    expect(booking.passenger_meta.first_name).toBe('Juan');
    expect(booking.passenger_meta.school).toBe('Ingeniería de Sistemas');
    expect(booking.passenger_meta.cycle).toBe(5);

    // Verificar en BD que la solicitud se registró con estado correcto
    const dbReq = await pool.query('SELECT * FROM carpooling_requests WHERE id = $1', [booking.request_id]);
    expect(dbReq.rows.length).toBe(1);
    expect(dbReq.rows[0].status).toBe('SEAT_REQUESTED');
  });

  it('Scenario 2: Rechazo de solicitudes duplicadas para la misma ruta activa', async () => {
    const routeRes = await pool.query(
      `INSERT INTO carpooling_routes (driver_id, origin_district, destination, departure_time, available_seats, price_soles, driver_alias)
       VALUES ($1, 'Carmen Alto', 'Campus Central', NOW() + INTERVAL '2 hours', 2, 2.50, 'Ing. Conductor')
       RETURNING id`,
      [driverId]
    );
    const routeId = routeRes.rows[0].id;

    // Primera solicitud: éxito
    await carpoolingService.requestSeat(routeId, passenger1Id);

    // Segunda solicitud del mismo pasajero: rechazada
    await expect(carpoolingService.requestSeat(routeId, passenger1Id)).rejects.toThrow(
      'Ya cuentas con una solicitud activa o confirmada para esta ruta.'
    );
  });

  it('Scenario 3: Verificación estricta de conductor autorizado al confirmar', async () => {
    const routeRes = await pool.query(
      `INSERT INTO carpooling_routes (driver_id, origin_district, destination, departure_time, available_seats, price_soles, driver_alias)
       VALUES ($1, 'Jesús Nazareno', 'Campus Central', NOW() + INTERVAL '2 hours', 2, 2.50, 'Ing. Conductor')
       RETURNING id`,
      [driverId]
    );
    const routeId = routeRes.rows[0].id;

    await carpoolingService.requestSeat(routeId, passenger1Id);

    // Intento de confirmación por un tercero intruso (no es el conductor de la ruta)
    await expect(carpoolingService.confirmSeat(routeId, intruderId, passenger1Id)).rejects.toThrow(
      'No estás autorizado para confirmar reservaciones en esta ruta.'
    );

    // Verificar que los asientos NO cambiaron
    const checkRoute = await pool.query('SELECT available_seats FROM carpooling_routes WHERE id = $1', [routeId]);
    expect(checkRoute.rows[0].available_seats).toBe(2);
  });

  it('Scenario 4: Confirmación autorizada por el conductor descuenta asiento y revela contactos', async () => {
    const routeRes = await pool.query(
      `INSERT INTO carpooling_routes (driver_id, origin_district, destination, departure_time, available_seats, price_soles, driver_alias)
       VALUES ($1, 'Ayacucho Centro', 'Campus Central', NOW() + INTERVAL '2 hours', 2, 2.50, 'Ing. Conductor')
       RETURNING id`,
      [driverId]
    );
    const routeId = routeRes.rows[0].id;

    await carpoolingService.requestSeat(routeId, passenger1Id);

    // Confirmación válida por el conductor
    const confirmRes = await carpoolingService.confirmSeat(routeId, driverId, passenger1Id);

    expect(confirmRes.status).toBe('SEAT_CONFIRMED');
    expect(confirmRes.driver_contact.full_name).toBe('Profesor Conductor');
    expect(confirmRes.driver_contact.phone_number).toBe('966000001');
    expect(confirmRes.passenger_contact.full_name).toBe('Juan Pasajero Sistemas');
    expect(confirmRes.passenger_contact.phone_number).toBe('966000002');

    // Verificar en BD que available_seats disminuyó exactamente en 1 (de 2 a 1)
    const checkRoute = await pool.query('SELECT available_seats FROM carpooling_routes WHERE id = $1', [routeId]);
    expect(checkRoute.rows[0].available_seats).toBe(1);

    // Verificar que la solicitud pasó a SEAT_CONFIRMED
    const checkReq = await pool.query('SELECT status FROM carpooling_requests WHERE route_id = $1 AND passenger_id = $2', [
      routeId,
      passenger1Id,
    ]);
    expect(checkReq.rows[0].status).toBe('SEAT_CONFIRMED');
  });

  it('Scenario 5: Confirmación repetida NO descuenta asientos adicionales', async () => {
    const routeRes = await pool.query(
      `INSERT INTO carpooling_routes (driver_id, origin_district, destination, departure_time, available_seats, price_soles, driver_alias)
       VALUES ($1, 'San Juan Bautista', 'Campus Central', NOW() + INTERVAL '2 hours', 2, 2.50, 'Ing. Conductor')
       RETURNING id`,
      [driverId]
    );
    const routeId = routeRes.rows[0].id;

    await carpoolingService.requestSeat(routeId, passenger1Id);
    await carpoolingService.confirmSeat(routeId, driverId, passenger1Id);

    // Asientos tras la primera confirmación = 1
    const seatsAfterFirst = (await pool.query('SELECT available_seats FROM carpooling_routes WHERE id = $1', [routeId])).rows[0].available_seats;
    expect(seatsAfterFirst).toBe(1);

    // Intento de re-confirmar la misma solicitud ya confirmada
    await expect(carpoolingService.confirmSeat(routeId, driverId, passenger1Id)).rejects.toThrow(
      'La solicitud ya no se encuentra activa o en espera.'
    );

    // Verificar que los asientos NO volvieron a descontarse
    const seatsAfterRepeat = (await pool.query('SELECT available_seats FROM carpooling_routes WHERE id = $1', [routeId])).rows[0].available_seats;
    expect(seatsAfterRepeat).toBe(1);
  });

  it('Scenario 6: Competencia por el último asiento con bloqueo transaccional', async () => {
    // Ruta con SOLO 1 asiento disponible
    const routeRes = await pool.query(
      `INSERT INTO carpooling_routes (driver_id, origin_district, destination, departure_time, available_seats, price_soles, driver_alias)
       VALUES ($1, 'Carmen Alto', 'Campus Central', NOW() + INTERVAL '2 hours', 1, 2.50, 'Ing. Conductor')
       RETURNING id`,
      [driverId]
    );
    const routeId = routeRes.rows[0].id;

    // Ambos pasajeros solicitan asiento
    await carpoolingService.requestSeat(routeId, passenger1Id);
    await carpoolingService.requestSeat(routeId, passenger2Id);

    // El conductor confirma a Pasajero 1: debe tener éxito
    const res1 = await carpoolingService.confirmSeat(routeId, driverId, passenger1Id);
    expect(res1.status).toBe('SEAT_CONFIRMED');

    // Los asientos disponibles llegaron a 0
    const seatsNow = (await pool.query('SELECT available_seats FROM carpooling_routes WHERE id = $1', [routeId])).rows[0].available_seats;
    expect(seatsNow).toBe(0);

    // El conductor intenta confirmar a Pasajero 2: debe fallar por agotamiento de asientos
    await expect(carpoolingService.confirmSeat(routeId, driverId, passenger2Id)).rejects.toThrow(
      'No quedan asientos libres en este trayecto.'
    );

    // Pasajero 2 permanece en SEAT_REQUESTED o estado inalterado sin asientos descontados por debajo de 0
    const checkReq2 = await pool.query('SELECT status FROM carpooling_requests WHERE route_id = $1 AND passenger_id = $2', [
      routeId,
      passenger2Id,
    ]);
    expect(checkReq2.rows[0].status).toBe('SEAT_REQUESTED');
    expect(seatsNow).toBe(0);
  });

  it('Scenario 7: Fallo intermedio no deja persistencia parcial inesperada (compensación)', async () => {
    const routeRes = await pool.query(
      `INSERT INTO carpooling_routes (driver_id, origin_district, destination, departure_time, available_seats, price_soles, driver_alias)
       VALUES ($1, 'Huamanga Centro', 'Campus Central', NOW() + INTERVAL '2 hours', 2, 2.50, 'Ing. Conductor')
       RETURNING id`,
      [driverId]
    );
    const routeId = routeRes.rows[0].id;

    // Simular un fallo forzado en getPassengerMeta
    jest.spyOn(CarpoolingRepository.prototype, 'getPassengerMeta').mockRejectedValueOnce(
      new Error('ERROR_SIMULADO_POST_CREACION')
    );

    await expect(carpoolingService.requestSeat(routeId, passenger1Id)).rejects.toThrow(
      'ERROR_SIMULADO_POST_CREACION'
    );

    // Verificar que la solicitud huérfana fue compensada y eliminada
    const checkRequests = await pool.query(
      'SELECT * FROM carpooling_requests WHERE route_id = $1 AND passenger_id = $2',
      [routeId, passenger1Id]
    );
    expect(checkRequests.rows.length).toBe(0);

    jest.restoreAllMocks();
  });
});
