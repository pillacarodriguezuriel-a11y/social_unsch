import { IFeedPost, IFeedRepository } from './ports';
import { FeedError } from './errors';

export class FeedService {
  constructor(private readonly feedRepository: IFeedRepository) {}

  private sanitizeXSS(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  async getFeed(
    facultyId?: number,
    schoolId?: number,
    page: number = 1,
    limit: number = 20
  ): Promise<IFeedPost[]> {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(50, Math.max(1, limit));
    const offset = (validPage - 1) * validLimit;
    return this.feedRepository.findFiltered(facultyId, schoolId, validLimit, offset);
  }

  async createPost(input: {
    userId: string;
    content: string;
    facultyId?: number | null;
    schoolId?: number | null;
  }): Promise<IFeedPost> {
    if (!input.content || input.content.trim().length === 0) {
      throw new FeedError(
        'El contenido de la publicación no puede estar vacío.',
        400,
        'ERR_VALIDATION_INVALID_FIELDS'
      );
    }

    if (input.content.length > 2000) {
      throw new FeedError(
        'El contenido de la publicación no debe superar los 2000 caracteres.',
        400,
        'ERR_VALIDATION_INVALID_FIELDS'
      );
    }

    const sanitizedContent = this.sanitizeXSS(input.content.trim());

    return this.feedRepository.create({
      userId: input.userId,
      content: sanitizedContent,
      facultyId: input.facultyId,
      schoolId: input.schoolId,
    });
  }
}
