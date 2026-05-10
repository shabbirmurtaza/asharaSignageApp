#!/usr/bin/env node
/**
 * PostgREST 12 still emits Swagger 2.0; openapi-typescript v7 only accepts
 * OpenAPI 3.x. So we fetch, convert with swagger2openapi, and pipe the
 * result into openapi-typescript via stdin.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sw2 from 'swagger2openapi';

const exec = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../src/types/db.ts');
const URL = process.env.POSTGREST_URL ?? 'http://localhost:3000';

const main = async () => {
  console.log(`[types] Fetching OpenAPI spec from ${URL}`);
  const res = await fetch(URL);
  if (!res.ok) {
    throw new Error(`PostgREST returned HTTP ${res.status}`);
  }
  const swagger = await res.json();

  console.log('[types] Converting Swagger 2.0 → OpenAPI 3.x');
  const { openapi } = await sw2.convertObj(swagger, { patch: true });

  const tmp = path.resolve(__dirname, '.openapi.tmp.json');
  await writeFile(tmp, JSON.stringify(openapi));

  console.log('[types] Running openapi-typescript');
  const { stdout } = await exec(
    'pnpm',
    ['exec', 'openapi-typescript', tmp, '-o', OUT],
    { cwd: path.resolve(__dirname, '..') },
  );
  if (stdout) console.log(stdout);

  await mkdir(path.dirname(OUT), { recursive: true });
  console.log(`[types] Wrote ${OUT}`);
};

main().catch((err) => {
  console.error('[types] FAILED:', err.message);
  process.exit(1);
});
