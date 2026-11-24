/**
 * Puertos del dominio Feed.
 *
 * Describe qué necesita el dominio de su entorno sin conocer la implementación.
 * Los adaptadores concretos (PgAuthorMetaAdapter, FeedRepository) se implementan
 * en cada workspace que consuma este paquete.
 *
 * Dependencia cruzada documentada (fase actual: PostgreSQL compartido):
 *  - IAuthorMetaReader: Feed necesita nombre y rol del autor desde Identidad.
 *    Actualmente se implementa con una consulta a la tabla `users`.
 *    En la extracción futura se reemplazará por HttpAuthorMetaAdapter.
 *  - JOIN en findFiltered(): la consulta SQL usa INNER JOIN con `users` para
 *    obtener author_name y author_role en una sola vuelta. Permanece en el
 *    adaptador de persistencia mientras PostgreSQL sea compartido.
 */

export interface IFeedPost {
  id: string;
  user_id: string;
  faculty_id: number | null;
  professional_school_id: number | null;
  content: string;
  is_visible: boolean;
  created_at: Date;
  author_name: string;
  author_role: string;
}

export interface IAuthorMeta {
  full_name: string;
  role: string;
}

export interface IAuthorMetaReader {
  getAuthorMeta(userId: string): Promise<IAuthorMeta | null>;
}

export interface IFeedRepository {
  findFiltered(
    facultyId?: number,
    schoolId?: number,
    limit?: number,
    offset?: number
  ): Promise<IFeedPost[]>;

  create(input: {
    userId: string;
    content: string;
    facultyId?: number | null;
    schoolId?: number | null;
  }): Promise<IFeedPost>;
}
