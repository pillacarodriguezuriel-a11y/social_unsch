import { PgAuthorMetaAdapter } from '../src/pg-feed.repository';

function makeDb(rows: unknown[]) {
  return { query: jest.fn().mockResolvedValue({ rows }) };
}

describe('PgAuthorMetaAdapter', () => {
  it('devuelve nombre y rol del autor', async () => {
    const db = makeDb([{ full_name: 'Ana Quispe', role: 'teacher' }]);
    const adapter = new PgAuthorMetaAdapter({ db, statementPrefix: 'prueba' });

    await expect(adapter.getAuthorMeta('user-001')).resolves.toEqual({
      full_name: 'Ana Quispe',
      role: 'teacher',
    });
  });

  it('consulta users por identificador y usa el prefijo de consulta preparada', async () => {
    const db = makeDb([{ full_name: 'Ana', role: 'student' }]);
    const adapter = new PgAuthorMetaAdapter({ db, statementPrefix: 'feed-svc' });

    await adapter.getAuthorMeta('user-007');

    expect(db.query).toHaveBeenCalledWith({
      name: 'feed-svc-author-meta',
      text: 'SELECT full_name, role FROM users WHERE id = $1',
      values: ['user-007'],
    });
  });

  it('devuelve null cuando el autor no existe', async () => {
    const adapter = new PgAuthorMetaAdapter({ db: makeDb([]), statementPrefix: 'prueba' });
    await expect(adapter.getAuthorMeta('inexistente')).resolves.toBeNull();
  });
});
