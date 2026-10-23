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

  it('Scenario 1: Consulta de metadatos con política canónica de ciclo académico (prioriza current_academic_cycle y null cuando es desconocido)', async () => {
    // Caso A: Usuario con discrepancia explícita (current_academic_cycle=8 vs legacy academic_cycle=1)
    await pool.query(
      'UPDATE users SET current_academic_cycle = 8, academic_cycle = 1 WHERE id = $1',
      [passenger1Id]
    );

    const routeRes = await pool.query(
      `INSERT INTO carpooling_routes (driver_id, origin_district, destination, departure_time, available_seats, price_soles, driver_alias)
       VALUES ($1, 'San Juan Bautista', 'Campus Central', NOW() + INTERVAL '2 hours', 2, 2.50, 'Ing. Conductor')
       RETURNING id`,
      [driverId]
    );
    const routeId = routeRes.rows[0].id;

    // Solicitar asiento: la política canónica debe priorizar current_academic_cycle (8) sobre 1
    const booking = await carpoolingService.requestSeat(routeId, passenger1Id);
    expect(booking.request_id).toBeDefined();
    expect(booking.status).toBe('SEAT_REQUESTED');
    expect(booking.passenger_meta.first_name).toBe('Juan');
    expect(booking.passenger_meta.school).toBe('Ingeniería de Sistemas');
    expect(booking.passenger_meta.cycle).toBe(8); // Prioriza el campo canónico 8

    // Caso B: Usuario con ciclo desconocido (ambos NULL, p.ej. egresado o docente pasajero)
    await pool.query(
      'UPDATE users SET current_academic_cycle = NULL, academic_cycle = NULL WHERE id = $1',
      [passenger2Id]
    );
    const bookingUnknown = await carpoolingService.requestSeat(routeId, passenger2Id);
    expect(bookingUnknown.passenger_meta.cycle).toBeNull(); // NUNCA inventa el ciclo 1
  });

  it('Scenario 2: Carrera concurrente con dos solicitudes simultáneas para el mismo pasajero y ruta', async () => {
    const routeRes = await pool.query(
      `INSERT INTO carpooling_routes (driver_id, origin_district, destination, departure_time, available_seats, price_soles, driver_alias)
       VALUES ($1, 'Carmen Alto', 'Campus Central', NOW() + INTERVAL '2 hours', 2, 2.50, 'Ing. Conductor')
       RETURNING id`,
      [driverId]
    );
    const routeId = routeRes.rows[0].id;

    // Disparar dos solicitudes en paralelo compitiendo exactamente en el mismo instante
    const [res1, res2] = await Promise.allSettled([
      carpoolingService.requestSeat(routeId, passenger1Id),
      carpoolingService.requestSeat(routeId, passenger1Id),
    ]);

    const successes = [res1, res2].filter((r) => r.status === 'fulfilled');
    const failures = [res1, res2].filter((r) => r.status === 'rejected');

    // Garantía 1: Exactamente una solicitud debe tener éxito
    expect(successes.length).toBe(1);

    // Garantía 2: La solicitud derrotada en la carrera debe traducirse a error de negocio 400
    expect(failures.length).toBe(1);
    const rejectedReason: any = (failures[0] as PromiseRejectedResult).reason;
    expect(rejectedReason.statusCode).toBe(400);
    expect(rejectedReason.errorCode).toBe('ERR_CARPOOLING_DUPLICATE_REQUEST');
    expect(rejectedReason.message).toContain('Ya cuentas con una solicitud activa o confirmada');

    // Garantía 3: Solo un registro persistido en la base de datos
    const checkCount = await pool.query(
      'SELECT COUNT(*) FROM carpooling_requests WHERE route_id = $1 AND passenger_id = $2',
      [routeId, passenger1Id]
    );
    expect(Number(checkCount.rows[0].count)).toBe(1);
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

  it('Scenario 7: Fallo transaccional deliberado revierte la solicitud (Rollback real en PostgreSQL sin depender de DELETE posterior)', async () => {
    const routeRes = await pool.query(
      `INSERT INTO carpooling_routes (driver_id, origin_district, destination, departure_time, available_seats, price_soles, driver_alias)
       VALUES ($1, 'Huamanga Centro', 'Campus Central', NOW() + INTERVAL '2 hours', 2, 2.50, 'Ing. Conductor')
       RETURNING id`,
      [driverId]
    );
    const routeId = routeRes.rows[0].id;

    // Disparar solicitud con fallo inyectado dentro de la transacción antes del COMMIT
    await expect(
      carpoolingService.requestSeat(routeId, passenger1Id, { injectedFailure: true })
    ).rejects.toMatchObject({
      statusCode: 500,
      errorCode: 'ERR_INJECTED_FAILURE',
    });

    // Garantía: PostgreSQL revirtió automáticamente la transacción;
    // Cero solicitudes persistidas en base de datos sin depender de DELETE posterior
    const checkRequests = await pool.query(
      'SELECT * FROM carpooling_requests WHERE route_id = $1 AND passenger_id = $2',
      [routeId, passenger1Id]
    );
    expect(checkRequests.rows.length).toBe(0);
  });
});
