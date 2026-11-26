import type { FeedService } from './feed.service';

/**
 * Manejadores HTTP del dominio Feed, sin framework.
 *
 * Devuelven `{ status, body }` en lugar de escribir en una respuesta, de modo
 * que `apps/api` (modo local) y `apps/feed` (servicio independiente) comparten
 * la misma validación, los mismos códigos de error y el mismo cuerpo. Los
 * errores se propagan para que cada proceso los traduzca en su middleware.
 *
 * Lo único que difiere entre los dos modos es de dónde sale el identificador
 * del usuario autenticado, porque cada proceso verifica el token con su propio
 * middleware: por eso `createPost` lo recibe ya resuelto.
 */

export interface FeedHttpResult {
  status: number;
  body: unknown;
}

export interface CreatePostInput {
  body: unknown;
  userId?: string;
}

const invalidQuery: FeedHttpResult = {
  status: 400,
  body: {
    error: true,
    message: 'Parámetros de consulta no válidos.',
    code: 'ERR_VALIDATION_INVALID_FIELDS',
  },
};

const unauthenticated: FeedHttpResult = {
  status: 401,
  body: {
    error: true,
    message: 'Usuario no autenticado en el contexto.',
    code: 'ERR_AUTH_UNAUTHORIZED',
  },
};

const invalidAcademicIds: FeedHttpResult = {
  status: 400,
  body: {
    error: true,
    message: 'Los identificadores académicos deben ser numéricos.',
    code: 'ERR_VALIDATION_INVALID_FIELDS',
  },
};

export class FeedHttpHandlers {
  constructor(private readonly feedService: FeedService) {}

  async getFeed(query: Record<string, unknown>): Promise<FeedHttpResult> {
    const facultyId = query.faculty_id ? Number(query.faculty_id) : undefined;
    const schoolId = query.school_id ? Number(query.school_id) : undefined;
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 20;

    if (
      (query.faculty_id && isNaN(facultyId!)) ||
      (query.school_id && isNaN(schoolId!)) ||
      (query.page && isNaN(page)) ||
      (query.limit && isNaN(limit))
    ) {
      return invalidQuery;
    }

    const posts = await this.feedService.getFeed(facultyId, schoolId, page, limit);
    return { status: 200, body: { data: posts } };
  }

  async createPost({ body, userId }: CreatePostInput): Promise<FeedHttpResult> {
    if (!userId) return unauthenticated;

    const { content, faculty_id, school_id } = (body ?? {}) as {
      content?: unknown;
      faculty_id?: unknown;
      school_id?: unknown;
    };

    const facultyId = faculty_id ? Number(faculty_id) : null;
    const schoolId = school_id ? Number(school_id) : null;

    if ((faculty_id && isNaN(facultyId!)) || (school_id && isNaN(schoolId!))) {
      return invalidAcademicIds;
    }

    // `content` se pasa tal cual para conservar el comportamiento ya desplegado:
    // ausente o vacío da 400 desde FeedService; un `content` no textual (por
    // ejemplo numérico) da 500. Queda registrado en el contrato compartido.
    const newPost = await this.feedService.createPost({
      userId,
      content: content as string,
      facultyId,
      schoolId,
    });

    return {
      status: 201,
      body: {
        success: true,
        message: 'Publicación creada exitosamente.',
        post_id: newPost.id,
      },
    };
  }
}
