/**
 * Manejadores HTTP compartidos por el modo local (apps/api) y el servicio
 * independiente (apps/feed). Lo que se comprueba aquí es exactamente lo que
 * ambos modos responden.
 */

import { FeedHttpHandlers } from '../src/http';
import { FeedService } from '../src/feed.service';
import { FeedError } from '../src/errors';
import type { IFeedPost, IFeedRepository } from '../src/ports';

const makePost = (overrides: Partial<IFeedPost> = {}): IFeedPost => ({
  id: 'post-001',
  user_id: 'user-001',
  faculty_id: null,
  professional_school_id: null,
  content: 'Contenido',
  is_visible: true,
  created_at: new Date('2026-11-25T00:00:00Z'),
  author_name: 'Autor',
  author_role: 'student',
  ...overrides,
});

function makeHandlers(repo: Partial<IFeedRepository> = {}) {
  const repository: IFeedRepository = {
    findFiltered: jest.fn().mockResolvedValue([makePost()]),
    create: jest.fn().mockResolvedValue(makePost({ id: 'post-nuevo' })),
    ...repo,
  };
  return { handlers: new FeedHttpHandlers(new FeedService(repository)), repository };
}

describe('getFeed', () => {
  it('devuelve 200 con las publicaciones envueltas en data', async () => {
    const { handlers } = makeHandlers();
    const result = await handlers.getFeed({});
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ data: [makePost()] });
  });

  it('aplica los valores por defecto de página y límite', async () => {
    const { handlers, repository } = makeHandlers();
    await handlers.getFeed({});
    expect(repository.findFiltered).toHaveBeenCalledWith(undefined, undefined, 20, 0);
  });

  it('traslada los filtros académicos y la paginación al repositorio', async () => {
    const { handlers, repository } = makeHandlers();
    await handlers.getFeed({ faculty_id: '2', school_id: '5', page: '3', limit: '10' });
    expect(repository.findFiltered).toHaveBeenCalledWith(2, 5, 10, 20);
  });

  it.each(['faculty_id', 'school_id', 'page', 'limit'])(
    'devuelve 400 ERR_VALIDATION_INVALID_FIELDS cuando %s no es numérico',
    async (campo) => {
      const { handlers, repository } = makeHandlers();
      const result = await handlers.getFeed({ [campo]: 'abc' });
      expect(result.status).toBe(400);
      expect(result.body).toMatchObject({ error: true, code: 'ERR_VALIDATION_INVALID_FIELDS' });
      expect(repository.findFiltered).not.toHaveBeenCalled();
    }
  );

  it('trata un parámetro vacío como ausente en lugar de inválido', async () => {
    const { handlers, repository } = makeHandlers();
    const result = await handlers.getFeed({ faculty_id: '', page: '' });
    expect(result.status).toBe(200);
    expect(repository.findFiltered).toHaveBeenCalledWith(undefined, undefined, 20, 0);
  });

  it('propaga el error del repositorio en lugar de ocultarlo', async () => {
    const { handlers } = makeHandlers({
      findFiltered: jest.fn().mockRejectedValue(new Error('PostgreSQL caído')),
    });
    await expect(handlers.getFeed({})).rejects.toThrow('PostgreSQL caído');
  });
});

describe('createPost', () => {
  it('devuelve 201 con el identificador de la publicación creada', async () => {
    const { handlers } = makeHandlers();
    const result = await handlers.createPost({ body: { content: 'Hola' }, userId: 'user-001' });
    expect(result.status).toBe(201);
    expect(result.body).toEqual({
      success: true,
      message: 'Publicación creada exitosamente.',
      post_id: 'post-nuevo',
    });
  });

  it('devuelve 401 ERR_AUTH_UNAUTHORIZED cuando no hay usuario resuelto', async () => {
    const { handlers, repository } = makeHandlers();
    const result = await handlers.createPost({ body: { content: 'Hola' } });
    expect(result.status).toBe(401);
    expect(result.body).toMatchObject({ error: true, code: 'ERR_AUTH_UNAUTHORIZED' });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it.each(['faculty_id', 'school_id'])(
    'devuelve 400 cuando %s no es numérico',
    async (campo) => {
      const { handlers, repository } = makeHandlers();
      const result = await handlers.createPost({
        body: { content: 'Hola', [campo]: 'xyz' },
        userId: 'user-001',
      });
      expect(result.status).toBe(400);
      expect(result.body).toMatchObject({ code: 'ERR_VALIDATION_INVALID_FIELDS' });
      expect(repository.create).not.toHaveBeenCalled();
    }
  );

  it('convierte identificadores ausentes en null', async () => {
    const { handlers, repository } = makeHandlers();
    await handlers.createPost({ body: { content: 'Hola' }, userId: 'user-001' });
    expect(repository.create).toHaveBeenCalledWith({
      userId: 'user-001',
      content: 'Hola',
      facultyId: null,
      schoolId: null,
    });
  });

  it('propaga FeedError 400 del dominio cuando el contenido está vacío', async () => {
    const { handlers } = makeHandlers();
    await expect(
      handlers.createPost({ body: { content: '   ' }, userId: 'user-001' })
    ).rejects.toBeInstanceOf(FeedError);
  });

  it('propaga FeedError 400 cuando falta el campo content', async () => {
    const { handlers } = makeHandlers();
    await expect(handlers.createPost({ body: {}, userId: 'user-001' })).rejects.toMatchObject({
      statusCode: 400,
      errorCode: 'ERR_VALIDATION_INVALID_FIELDS',
    });
  });

  it('tolera un cuerpo ausente sin romper la extracción de campos', async () => {
    const { handlers } = makeHandlers();
    await expect(
      handlers.createPost({ body: undefined, userId: 'user-001' })
    ).rejects.toBeInstanceOf(FeedError);
  });
});
