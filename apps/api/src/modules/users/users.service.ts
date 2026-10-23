import { UsersRepository } from './users.repository';
import { AppError } from '../../shared/errors/AppError';

export class UsersService {
  private usersRepository = new UsersRepository();

  /**
   * Marca los términos y condiciones como aceptados para un usuario específico.
   * @param userId UUID del usuario
   */
  async acceptTerms(userId: string): Promise<void> {
    const success = await this.usersRepository.acceptTerms(userId);
    if (!success) {
      throw new AppError(
        'El usuario especificado no existe o no se pudo actualizar.',
        404,
        'ERR_USER_NOT_FOUND'
      );
    }
  }
}
