import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';

async function verificar(pasta) {
  let total = 0;
  for (const arquivo of await readdir(pasta, { withFileTypes: true })) {
    const caminho = join(pasta, arquivo.name);
    if (arquivo.isDirectory()) { total += await verificar(caminho); continue; }
    if (!/\.(js|css|html|map|json)$/.test(arquivo.name)) continue;
    const texto = await readFile(caminho, 'utf8');
    assert.ok(!/sb_secret_[A-Za-z0-9_-]{12,}/.test(texto), 'Credencial secret encontrada no artefato público.');
    assert.ok(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(texto), 'Chave privada encontrada no artefato público.');
    for (const jwt of texto.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
      let papel;
      try { papel = JSON.parse(Buffer.from(jwt[1], 'base64url').toString()).role; } catch { continue; }
      assert.notEqual(papel, 'service_role', 'JWT service_role encontrado no artefato público.');
    }
    total++;
  }
  return total;
}
const arquivos = await verificar('dist/vitrine');
assert.ok(arquivos > 0, 'Build público ausente.');
console.log(`${arquivos} arquivos do build verificados: sem credenciais secret, JWT service_role ou chaves privadas.`);
