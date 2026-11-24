import { Request, Response, NextFunction } from 'express';
import { FeedService } from '@social-unsch/feed-domain';

export class FeedController {
  private readonly feedService: FeedService;

  constructor(feedService: FeedService) {
    this.feedService = feedService;
  }

  getFeed = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const facultyId = req.query.faculty_id ? Number(req.query.faculty_id) : undefined;
      const schoolId = req.query.school_id ? Number(req.query.school_id) : undefined;
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 20;

      if (
        (req.query.faculty_id && isNaN(facultyId!)) ||
        (req.query.school_id && isNaN(schoolId!)) ||
        (req.query.page && isNaN(page)) ||
        (req.query.limit && isNaN(limit))
      ) {
        res.status(400).json({
          error: true,
          message: 'Parámetros de consulta no válidos.',
          code: 'ERR_VALIDATION_INVALID_FIELDS',
        });
        return;
      }

      const posts = await this.feedService.getFeed(facultyId, schoolId, page, limit);
      res.status(200).json({ data: posts });
    } catch (error) {
      next(error);
    }
  };

  createPost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { content, faculty_id, school_id } = req.body;
      const userId = req.user?.user_id;

      if (!userId) {
        res.status(401).json({
          error: true,
          message: 'Usuario no autenticado en el contexto.',
          code: 'ERR_AUTH_UNAUTHORIZED',
        });
        return;
      }

      const facultyId = faculty_id ? Number(faculty_id) : null;
      const schoolId = school_id ? Number(school_id) : null;

      if (
        (faculty_id && isNaN(facultyId!)) ||
        (school_id && isNaN(schoolId!))
      ) {
        res.status(400).json({
          error: true,
          message: 'Los identificadores académicos deben ser numéricos.',
          code: 'ERR_VALIDATION_INVALID_FIELDS',
        });
        return;
      }

      const newPost = await this.feedService.createPost({
        userId,
        content,
        facultyId,
        schoolId,
      });

      res.status(201).json({
        success: true,
        message: 'Publicación creada exitosamente.',
        post_id: newPost.id,
      });
    } catch (error) {
      next(error);
    }
  };
}
