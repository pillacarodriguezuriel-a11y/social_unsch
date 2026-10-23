import { FeedRepository, FeedPost } from './feed.repository';
import { AppError } from '../../shared/errors/AppError';

export class FeedService {
  private feedRepository = new FeedRepository();

  /**
   * Sanitiza entradas de texto para prevenir ataques Cross-Site Scripting (XSS).
   * Reemplaza caracteres especiales HTML por sus entidades seguras correspondientes.
   */
  private sanitizeXSS(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Recupera las publicaciones visibles aplicando paginación y filtros.
   */
  async getFeed(
    facultyId?: number,
    schoolId?: number,
    page: number = 1,
    limit: number = 20
  ): Promise<FeedPost[]> {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(50, Math.max(1, limit)); // Capar a un máximo de 50 posts
    const offset = (validPage - 1) * validLimit;

    return this.feedRepository.findFiltered(facultyId, schoolId, validLimit, offset);
  }

  /**
   * Crea una nueva publicación en el feed tras sanitizar el contenido.
   */
  async createPost(input: {
    userId: string;
    content: string;
    facultyId?: number | null;
    schoolId?: number | null;
  }): Promise<FeedPost> {
    if (!input.content || input.content.trim().length === 0) {
      throw new AppError(
        'El contenido de la publicación no puede estar vacío.',
        400,
        'ERR_VALIDATION_INVALID_FIELDS'
      );
    }

    if (input.content.length > 2000) {
      throw new AppError(
        'El contenido de la publicación no debe superar los 2000 caracteres.',
        400,
        'ERR_VALIDATION_INVALID_FIELDS'
      );
    }

    // Sanitizar contra ataques XSS
    const sanitizedContent = this.sanitizeXSS(input.content.trim());

    return this.feedRepository.create({
      userId: input.userId,
      content: sanitizedContent,
      facultyId: input.facultyId,
      schoolId: input.schoolId,
    });
  }
}
