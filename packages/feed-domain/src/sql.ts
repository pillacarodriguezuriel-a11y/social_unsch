/**
 * Puerto estructural de acceso SQL.
 *
 * `pg.Pool` lo satisface sin que este paquete importe `pg`: el dominio conserva
 * cero dependencias de ejecución y el límite `feed-domain-puro` sigue vigente.
 */

export interface SqlQuery {
  /** Nombre de la consulta preparada. Cada proceso usa su propio prefijo. */
  name?: string;
  text: string;
  values?: unknown[];
}

export interface SqlQueryable {
  query<R>(query: SqlQuery): Promise<{ rows: R[] }>;
}
