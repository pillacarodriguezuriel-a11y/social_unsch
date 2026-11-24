/**
 * Puertos del dominio Feed.
 *
 * Un puerto describe qué necesita el dominio de su entorno, sin conocer
 * la implementación. Los adaptadores implementan estos contratos.
 *
 * Dependencia cruzada documentada (fase actual: PostgreSQL compartido):
 *  - IAuthorMetaReader: el dominio Feed necesita leer nombre y rol del autor
 *    desde el dominio Identidad. En esta fase se implementa con una consulta
 *    directa a la tabla `users` vía PgAuthorMetaAdapter. Cuando Feed se extraiga
 *    a un proceso propio, este puerto se reemplazará por un adaptador HTTP o
 *    de mensajería sin cambiar el código de FeedService ni FeedRepository.
 *
 *  - JOIN en findFiltered(): la consulta SQL usa INNER JOIN con `users` para
 *    obtener author_name y author_role en una sola vuelta. Este join permanece
 *    dentro del adaptador de persistencia (PgFeedRepository) y está documentado
 *    aquí como acceso cruzado vía base de datos compartida. No se elimina en
 *    esta fase: hacerlo requeriría denormalizar datos o añadir una llamada
 *    adicional por post, lo cual solo está justificado al separar las bases.
 */

/** Publicación completa tal como la devuelve el dominio Feed a sus consumidores. */
export interface IFeedPost {
  id: string;
  user_id: string;
  faculty_id: number | null;
  professional_school_id: number | null;
  content: string;
  is_visible: boolean;
  created_at: Date;
  /** Acceso cruzado a Identidad: nombre del autor. */
  author_name: string;
  /** Acceso cruzado a Identidad: rol del autor. */
  author_role: string;
}

/** Metadatos del autor que el dominio Feed necesita de Identidad. */
export interface IAuthorMeta {
  full_name: string;
  role: string;
}

/**
 * Puerto: lector de metadatos de autor.
 * Encapsula el acceso al dominio Identidad desde el dominio Feed.
 * Implementación actual: PgAuthorMetaAdapter (tabla `users`).
 * Implementación futura: HttpAuthorMetaAdapter (servicio Identidad).
 */
export interface IAuthorMetaReader {
  getAuthorMeta(userId: string): Promise<IAuthorMeta | null>;
}

/** Puerto: persistencia del dominio Feed. */
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
