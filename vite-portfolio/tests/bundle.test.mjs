// Run after build: enforces the accepted non-3D gzip budget independently of timing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const directory = '.vercel/output/static/_astro';
test('non-3D page scripts including HTMX stay below 25 KB gzip', { skip: !existsSync(directory) }, () => {
  const files = readdirSync(directory).filter(name => name.endsWith('.js') && !name.startsWith('ocean.'));
  assert.ok(files.length > 0);
  const bytes = files.reduce((sum, name) => sum + gzipSync(readFileSync(`${directory}/${name}`), { level: 9 }).length, 0);
  assert.ok(bytes <= 25_000, `page scripts: ${bytes} gzip bytes`);
});
