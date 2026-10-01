import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const first = JSON.parse(await readFile('test-results/database-supabase-limpo-1.json', 'utf8'));
const second = JSON.parse(await readFile('test-results/database-supabase-limpo-2.json', 'utf8'));
assert.equal(first.runs[0].fingerprint, second.runs[0].fingerprint);
assert.deepEqual(first.runs[0].passed, second.runs[0].passed);
console.log('Dois resets do Supabase produziram o mesmo schema e os mesmos resultados.');
