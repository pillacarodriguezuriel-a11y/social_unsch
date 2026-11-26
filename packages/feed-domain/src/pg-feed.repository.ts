import type { IAuthorMeta, IAuthorMetaReader, IFeedPost, IFeedRepository } from './ports';
import type { SqlQueryable } from './sql';

/**
 * Única implementación SQL del repositorio Feed.
 *
 * La comparten `apps/api` (modo local) y `apps/feed` (servicio independiente):
 * un cambio de filtro, orden o paginación afecta a los dos modos a la vez, de
 * modo que no pueden divergir en silencio.
 *
 * `statementPrefix` separa el espacio de nombres de las consultas preparadas de
 * cada proceso, que es el comportamiento ya desplegado.
 */
export class PgFeedRepository implements IFeedRepository {
  private readonly db: SqlQueryable;
  private readonly authorMetaReader: IAuthorMetaReader;
  private readonly statementPrefix: string;

  constructor(options: {
    db: SqlQueryable;
    authorMetaReader: IAuthorMetaReader;
    statementPrefix: string;
  }) {
    this.db = options.db;
    this.authorMetaReader = options.authorMetaReader;
    this.statementPrefix = options.statementPrefix;
  }

  /**
   * Acceso cruzado a Identidad: INNER JOIN con `users` para resolver autor en
   * una sola vuelta mientras PostgreSQL sea compartido (ver ports.ts).
   */
  async findFiltered(
    facultyId?: number,
    schoolId?: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<IFeedPost[]> {
    let text = `
      SELECT f.id, f.user_id, f.faculty_id, f.professional_school_id, f.content, f.is_visible, f.created_at,
             u.full_name as author_name, u.role as author_role
      FROM feed_posts f
      INNER JOIN users u ON f.user_id = u.id
      WHERE f.is_visible = true
    `;

    const values: unknown[] = [];
    let paramIndex = 1;

    if (facultyId) {
      text += ` AND f.faculty_id = $${paramIndex}`;
      values.push(facultyId);
      paramIndex++;
    }

    if (schoolId) {
      text += ` AND f.professional_school_id = $${paramIndex}`;
      values.push(schoolId);
      paramIndex++;
    }

    text += ` ORDER BY f.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(limit, offset);

    const result = await this.db.query<IFeedPost>({
      name: `${this.statementPrefix}-filtered-${facultyId || 0}-${schoolId || 0}`,
      text,
      values,
    });
    return result.rows;
  }

  async create(input: {
    userId: string;
    content: string;
    facultyId?: number | null;
    schoolId?: number | null;
  }): Promise<IFeedPost> {
    const { userId, content, facultyId = null, schoolId = null } = input;

    const result = await this.db.query<IFeedPost>({
      name: `${this.statementPrefix}-insert-post`,
      text: `
        INSERT INTO feed_posts (user_id, faculty_id, professional_school_id, content, is_visible, created_at)
        VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP)
        RETURNING id, user_id, faculty_id, professional_school_id, content, is_visible, created_at
      `,
      values: [userId, facultyId, schoolId, content],
    });
    const post = result.rows[0];

    const author = await this.authorMetaReader.getAuthorMeta(userId);

    return {
      ...post,
      author_name: author?.full_name ?? '',
      author_role: author?.role ?? '',
    };
  }
}

/**
 * Lee nombre y rol del autor desde `users`.
 *
 * Único punto en el que Feed consulta datos que no son de su propiedad. Cuando
 * Identidad se extraiga, se sustituye por un adaptador HTTP sin tocar
 * `PgFeedRepository` ni `FeedService`.
 */
export class PgAuthorMetaAdapter implements IAuthorMetaReader {
  private readonly db: SqlQueryable;
  private readonly statementPrefix: string;

  constructor(options: { db: SqlQueryable; statementPrefix: string }) {
    this.db = options.db;
    this.statementPrefix = options.statementPrefix;
  }

  async getAuthorMeta(userId: string): Promise<IAuthorMeta | null> {
    const result = await this.db.query<IAuthorMeta>({
      name: `${this.statementPrefix}-author-meta`,
      text: 'SELECT full_name, role FROM users WHERE id = $1',
      values: [userId],
    });
    return result.rows[0] ?? null;
  }
}
