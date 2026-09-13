import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const SRC = 'src';
// sortie surchargeable pour que les tests ne clobbent pas le dist charge dans le navigateur
const DIST = process.env.WARHADEX_DIST || 'dist';
const TARGETS = ['chrome', 'firefox', 'safari'];
const FICHIER_CLE = 'cle-api.local';

// La cle vient de l environnement ou d un fichier local ignore par git. Elle est
// ecrite dans dist seulement : src garde sa valeur vide versionnee
async function lireCle() {
  if (process.env.WARHADEX_API_KEY) return process.env.WARHADEX_API_KEY.trim();
  if (existsSync(FICHIER_CLE)) return (await readFile(FICHIER_CLE, 'utf8')).trim();
  return '';
}

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

async function buildTarget(target, base, overrides, cle) {
  const outDir = path.join(DIST, target);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await cp(SRC, outDir, { recursive: true });
  await rm(path.join(outDir, 'manifest.firefox.json'), { force: true });

  const manifest = target === 'firefox' ? mergeDeep(base, overrides) : base;
  await writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  // JSON.stringify echappe la valeur : une cle ne peut pas injecter de code
  await writeFile(
    path.join(outDir, 'core', 'config.js'),
    `export const CLE_API_PAR_DEFAUT = ${JSON.stringify(cle)};\n`
  );
}

const base = JSON.parse(await readFile(path.join(SRC, 'manifest.json'), 'utf8'));
const overrides = JSON.parse(await readFile(path.join(SRC, 'manifest.firefox.json'), 'utf8'));

const cle = await lireCle();
if (!cle) {
  process.stderr.write(
    `Aucune cle d API : definir WARHADEX_API_KEY ou creer ${FICHIER_CLE}. L extension devra la recevoir depuis ses options\n`
  );
}

for (const target of TARGETS) {
  await buildTarget(target, base, overrides, cle);
}
