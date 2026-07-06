import { CarpoolingRepository, RouteDetail, ContactInfo } from './carpooling.repository';
import { AppError } from '../../shared/errors/AppError';

export class CarpoolingService {
  private carpoolingRepository = new CarpoolingRepository();

  /**
   * Obtiene las rutas activas para mostrar en el feed público de carpooling.
   */
  async getActiveRoutes(originDistrict?: string): Promise<RouteDetail[]> {
    return this.carpoolingRepository.findActiveRoutes(originDistrict);
  }

  /**
   * Registra una solicitud de asiento, comprobando validez y minimizando datos visibles en el retorno.
   */
  async requestSeat(routeId: string, passengerId: string) {
    // 1. Obtener la ruta
    const route = await this.carpoolingRepository.findRouteById(routeId);
    if (!route) {
      throw new AppError('Ruta no encontrada.', 404, 'ERR_CARPOOLING_ROUTE_NOT_FOUND');
    }

    // 2. Verificar que el pasajero no sea el conductor de la ruta
    if (route.driver_id === passengerId) {
      throw new AppError(
        'No puedes solicitar un asiento en tu propia ruta.',
        400,
        'ERR_CARPOOLING_SELF_BOOKING'
      );
    }

    // 3. Verificar asientos disponibles
    if (route.available_seats <= 0) {
      throw new AppError(
        'No hay asientos disponibles en esta ruta académica.',
        400,
        'ERR_CARPOOLING_NO_SEATS'
      );
    }

    // 4. Verificar solicitud previa activa
    const existingRequest = await this.carpoolingRepository.findRequest(routeId, passengerId);
    if (existingRequest && (existingRequest.status === 'SEAT_REQUESTED' || existingRequest.status === 'SEAT_CONFIRMED')) {
      throw new AppError(
        'Ya cuentas con una solicitud activa o confirmada para esta ruta.',
        400,
        'ERR_CARPOOLING_DUPLICATE_REQUEST'
      );
    }

    // 5. Crear solicitud en base de datos
    const request = await this.carpoolingRepository.createRequest(routeId, passengerId);

    // 6. Obtener metadata del pasajero para el conductor
    const passengerMeta = await this.carpoolingRepository.getPassengerMeta(passengerId);
    
    // Extraer solo el primer nombre
    const firstName = passengerMeta?.full_name ? passengerMeta.full_name.split(' ')[0] : 'Estudiante';
    const school = passengerMeta?.school_name || 'Comunidad';
    const cycle = passengerMeta?.academic_cycle || 1;

    return {
      request_id: request.id,
      route_id: request.route_id,
      status: request.status,
      driver_alias: route.driver_alias,
      available_seats: route.available_seats,
      passenger_meta: {
        first_name: firstName,
        school: school,
        cycle: cycle,
      },
    };
  }

  /**
   * Aprueba la reservación de carpooling de forma transaccional desvelando contactos (Dynamic Handshake).
   */
  async confirmSeat(routeId: string, driverId: string, passengerId: string) {
    try {
      const contacts = await this.carpoolingRepository.confirmBookingTransaction(
        routeId,
        driverId,
        passengerId
      );

      return {
        route_id: routeId,
        status: 'SEAT_CONFIRMED' as const,
        driver_contact: {
          full_name: contacts.driverContact.full_name,
          email: contacts.driverContact.email,
          phone_number: contacts.driverContact.phone_number,
          whatsapp_link: contacts.driverContact.whatsapp_link,
        },
        passenger_contact: {
          full_name: contacts.passengerContact.full_name,
          email: contacts.passengerContact.email,
          phone_number: contacts.passengerContact.phone_number,
          whatsapp_link: contacts.passengerContact.whatsapp_link,
        },
      };
    } catch (error: any) {
      if (error.message === 'ROUTE_NOT_FOUND') {
        throw new AppError('Ruta académica no encontrada.', 404, 'ERR_CARPOOLING_ROUTE_NOT_FOUND');
      }
      if (error.message === 'NOT_ROUTE_DRIVER') {
        throw new AppError(
          'No estás autorizado para confirmar reservaciones en esta ruta.',
          403,
          'ERR_CARPOOLING_FORBIDDEN'
        );
      }
      if (error.message === 'NO_SEATS_AVAILABLE') {
        throw new AppError(
          'No quedan asientos libres en este trayecto.',
          400,
          'ERR_CARPOOLING_NO_SEATS'
        );
      }
      if (error.message === 'REQUEST_NOT_FOUND') {
        throw new AppError(
          'La solicitud de asiento seleccionada no existe.',
          404,
          'ERR_CARPOOLING_REQUEST_NOT_FOUND'
        );
      }
      if (error.message === 'INVALID_REQUEST_STATUS') {
        throw new AppError(
          'La solicitud ya no se encuentra activa o en espera.',
          400,
          'ERR_CARPOOLING_INVALID_STATE'
        );
      }
      throw error;
    }
  }
}
