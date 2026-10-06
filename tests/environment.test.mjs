import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarAmbiente } from '../apps/vitrine/src/ambiente.ts';
import criarConfig from '../apps/vitrine/vite.config.ts';
import { build } from 'vite';

const referencia = 'abcdefghijklmnopqrst';
const homologacao = {
  VITE_APP_ENV: 'homologation',
  VITE_SUPABASE_URL: `https://${referencia}.supabase.co`,
  VITE_SUPABASE_PROJECT_REF: referencia,
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_CHAVE_FICTICIA_PARA_TESTE',
};
test('homologação exige URL correspondente ao projeto esperado e chave pública', () => {
  assert.equal(validarAmbiente(homologacao, true).referencia, referencia);
  for (const alteracao of [
    { VITE_SUPABASE_URL: 'https://outroprojeto.supabase.co' },
    { VITE_SUPABASE_URL: `http://${referencia}.supabase.co` },
    { VITE_SUPABASE_PROJECT_REF: '' },
    { VITE_SUPABASE_PUBLISHABLE_KEY: '' },
  ]) assert.throws(() => validarAmbiente({ ...homologacao, ...alteracao }, true));
});
test('chaves secretas, JWT service_role e variáveis privadas são recusadas', () => {
  const jwt = ['eyJhbGciOiJIUzI1NiJ9', Buffer.from('{"role":"service_role"}').toString('base64url'), 'assinatura_ficticia'].join('.');
  for (const chave of ['sb_secret_CREDENCIAL_FICTICIA', jwt]) {
    assert.throws(() => validarAmbiente({ ...homologacao, VITE_SUPABASE_PUBLISHABLE_KEY: chave }, true));
  }
  assert.throws(() => validarAmbiente({ ...homologacao, VITE_ADMIN_TOKEN: 'teste' }, true));
});
test('produção é recusada e DEV não pode apontar para banco hospedado', () => {
  assert.throws(() => validarAmbiente({ ...homologacao, VITE_APP_ENV: 'production' }, true));
  assert.throws(() => validarAmbiente({ ...homologacao, VITE_APP_ENV: 'development' }, true));
  assert.equal(validarAmbiente({ VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_PUBLISHABLE_KEY: homologacao.VITE_SUPABASE_PUBLISHABLE_KEY }, true).ambiente, 'development');
});
test('CI pode compilar sem conexão; deploy de preview exige configuração', () => {
  assert.equal(validarAmbiente({}), null);
  assert.throws(() => validarAmbiente({}, true));
});
test('configuração Vite bloqueia target de produção', () => {
  const anterior = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = 'production';
  try { assert.throws(() => criarConfig({ command: 'build', mode: 'homologation' }), /produção/); }
  finally { if (anterior === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = anterior; }
});
test('configuração Vite bloqueia preview não vinculado à homologação', () => {
  const anterior = process.env.VERCEL_ENV;
  const ambienteAnterior = process.env.VITE_APP_ENV;
  process.env.VERCEL_ENV = 'preview';
  process.env.VITE_APP_ENV = 'development';
  try { assert.throws(() => criarConfig({ command: 'build', mode: 'homologation' })); }
  finally {
    if (anterior === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = anterior;
    if (ambienteAnterior === undefined) delete process.env.VITE_APP_ENV; else process.env.VITE_APP_ENV = ambienteAnterior;
  }
});
test('preview compila com metadados Vercel e não os envia ao navegador', async () => {
  const metadado = 'HOMOLOGACAO_METADADO_INTERNO_NAO_PUBLICAR';
  const variaveis = {
    ...homologacao, VERCEL_ENV: 'preview', VITE_VERCEL_ENV: 'preview',
    VITE_VERCEL_GIT_COMMIT_MESSAGE: metadado,
  };
  const anteriores = Object.fromEntries(Object.keys(variaveis).map(nome => [nome, process.env[nome]]));
  Object.assign(process.env, variaveis);
  try {
    const config = criarConfig({ command: 'build', mode: 'homologation' });
    const resultado = await build({ ...config, configFile: false, logLevel: 'silent',
      build: { ...config.build, write: false } });
    const artefatos = (Array.isArray(resultado) ? resultado : [resultado])
      .flatMap(item => item.output).map(item => item.type === 'chunk' ? item.code : String(item.source)).join('\n');
    assert.ok(artefatos.includes(homologacao.VITE_SUPABASE_PUBLISHABLE_KEY));
    assert.ok(!artefatos.includes(metadado));
    process.env.VITE_ADMIN_TOKEN = 'CREDENCIAL_FICTICIA_NAO_PERMITIDA';
    try { assert.throws(() => criarConfig({ command: 'build', mode: 'homologation' }), /não prevista/); }
    finally { delete process.env.VITE_ADMIN_TOKEN; }
  } finally {
    for (const [nome, valor] of Object.entries(anteriores)) {
      if (valor === undefined) delete process.env[nome]; else process.env[nome] = valor;
    }
  }
});
