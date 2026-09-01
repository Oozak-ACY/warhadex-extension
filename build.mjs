import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SRC = 'src';
const DIST = 'dist';
const TARGETS = ['chrome', 'firefox', 'safari'];

function mergeDeep(base, patch) {
  const out = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete out[key];
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = mergeDeep(out[key] ?? {}, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

async function buildTarget(target, base, overrides) {
  const outDir = path.join(DIST, target);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await cp(SRC, outDir, { recursive: true });
  await rm(path.join(outDir, 'manifest.firefox.json'), { force: true });

  const manifest = target === 'firefox' ? mergeDeep(base, overrides) : base;
  await writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

const base = JSON.parse(await readFile(path.join(SRC, 'manifest.json'), 'utf8'));
const overrides = JSON.parse(await readFile(path.join(SRC, 'manifest.firefox.json'), 'utf8'));

for (const target of TARGETS) {
  await buildTarget(target, base, overrides);
}
