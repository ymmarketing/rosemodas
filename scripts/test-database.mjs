import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import pg from 'pg';

const migrations = (await readdir('supabase/migrations')).filter(n => n.endsWith('.sql')).sort();
assert.equal(migrations.length, 1, 'Tarefa 1 deve conter somente a primeira migration.');
const migration = await readFile(`supabase/migrations/${migrations[0]}`, 'utf8');
const suite = await readFile('tests/database/fase-0.sql', 'utf8');
const fixture = await readFile('tests/database/platform-fixture.sql', 'utf8');
const report = { status: 'CONSTRUCAO_AGUARDANDO_VALIDACAO', migration: migrations[0], runs: [] };

async function validate(db, name, apply) {
  if (apply) {
    await db.exec(fixture);
    try { await db.exec(migration); }
    catch (error) { throw new Error(`Migration ${error.code}: ${error.message}\n${error.where ?? ''}`); }
  }
  const metadata = await db.query(`
    select 'table' as kind, c.relname as name, c.relrowsecurity::text as detail
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r'
    union all select 'constraint', conname, pg_get_constraintdef(oid)
      from pg_constraint where connamespace='public'::regnamespace
    union all select 'index', indexname, indexdef from pg_indexes where schemaname='public'
    union all select 'policy', tablename||'.'||policyname, coalesce(qual,'')||coalesce(with_check,'')
      from pg_policies where schemaname in ('public','storage') and policyname <> ''
    union all select 'view', c.relname, pg_get_viewdef(c.oid)||coalesce(c.reloptions::text,'')
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v'
    order by kind, name, detail
  `);
  const fingerprint = createHash('sha256').update(JSON.stringify(metadata.rows)).digest('hex');
  const version = (await db.query('select version() as version')).rows[0].version;
  const notices = [];
  db.onNotice?.(message => notices.push(message));
  try { await db.exec(suite); }
  catch (error) { throw new Error(`Suíte ${error.code}: ${error.message}\n${error.where ?? ''}`); }
  const passed = notices.filter(message => message.includes('PASS:')).map(message => message.slice(message.indexOf('PASS:')));
  assert.equal(passed.length, 12, `Esperados 12 grupos de testes, encontrados ${passed.length}`);
  console.log(`${name}: ${passed.length} grupos aprovados; schema ${fingerprint.slice(0,12)}`);
  report.runs.push({ name, version, fingerprint, passed });
  return fingerprint;
}

if (process.argv.includes('--supabase')) {
  const url = process.env.SUPABASE_TEST_DATABASE_URL;
  assert.ok(url, 'Informe SUPABASE_TEST_DATABASE_URL para o Supabase LOCAL descartável.');
  const parsed = new URL(url);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname), 'O runner recusa bancos remotos.');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  let listener;
  const db = {
    query: sql => client.query(sql),
    exec: sql => client.query(sql),
    onNotice: callback => { listener = msg => callback(msg.message); client.on('notice', listener); },
  };
  try { await validate(db, process.env.TEST_DATABASE_RUN_NAME ?? 'supabase-local', false); }
  finally { if (listener) client.off('notice', listener); await client.end(); }
} else {
  let first;
  for (const name of ['dev-limpo', 'homologacao-limpa']) {
    let noticeListener = () => {};
    const db = new PGlite({ extensions: { pg_trgm } });
    const adapter = { query: sql => db.query(sql), exec: sql => db.exec(sql, { onNotice: msg => noticeListener(msg.message) }), onNotice: callback => { noticeListener = callback; } };
    try {
      const fingerprint = await validate(adapter, name, true);
      if (first) assert.equal(fingerprint, first, 'Schemas resultantes das duas bases devem coincidir.');
      first = fingerprint;
    } finally { await db.close(); }
  }
}
await mkdir('test-results', { recursive: true });
await writeFile(`test-results/database-${process.argv.includes('--supabase') ? process.env.TEST_DATABASE_RUN_NAME ?? 'supabase' : 'pglite'}.json`, JSON.stringify(report, null, 2));
console.log('Migration, constraints, RLS e escopo da Fase 0 validados.');
