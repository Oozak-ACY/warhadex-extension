import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Reproduit le sous-ensemble de routes que l extension consomme, sur les memes
// formes de reponse que l API reelle. Le jeu de donnees est constitue
// d agregats captures tels quels
const datasheets = JSON.parse(
  await readFile(new URL('./data/datasheets.json', import.meta.url), 'utf8')
);
const abilities = JSON.parse(
  await readFile(new URL('./data/abilities.json', import.meta.url), 'utf8')
);

function score(query, name) {
  const cible = name.toLowerCase();
  if (query === cible) return 100;
  if (cible.includes(query) || query.includes(cible)) return 60;

  const motsQuery = new Set(query.split(' ').filter(Boolean));
  const motsCible = new Set(cible.split(' ').filter(Boolean));
  let communs = 0;
  for (const mot of motsQuery) if (motsCible.has(mot)) communs += 1;
  if (!communs) return 0;

  const union = new Set([...motsQuery, ...motsCible]).size;
  return Math.round((communs / union) * 100);
}

function rechercher(query) {
  return datasheets
    .map((sheet) => ({ sheet, valeur: score(query, sheet.name) }))
    .filter((entree) => entree.valeur >= 20)
    .sort((a, b) => b.valeur - a.valeur)
    .map(({ sheet, valeur }) => ({
      type: 'datasheet',
      id: sheet.id,
      name: sheet.name,
      score: valeur
    }));
}

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'content-length': Buffer.byteLength(payload)
  });
  res.end(payload);
}

function paginer(res, items, url) {
  const limit = Number(url.searchParams.get('limit') ?? 50);
  const offset = Number(url.searchParams.get('offset') ?? 0);
  return send(res, 200, {
    items: items.slice(offset, offset + limit),
    total: items.length,
    limit,
    offset,
    fuzzy: false
  });
}

export function startServer({ port = 8787 } = {}) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');

    if (url.pathname === '/health') {
      return send(res, 200, {
        status: 'ok',
        counts: { datasheets: datasheets.length, abilities: abilities.length }
      });
    }

    if (url.pathname === '/search') {
      const query = (url.searchParams.get('q') ?? '').trim().toLowerCase();
      if (!query) return send(res, 400, { detail: 'parametre q obligatoire' });
      const type = url.searchParams.get('type');
      const items = type && type !== 'datasheet' ? [] : rechercher(query);
      return paginer(res, items, url);
    }

    if (url.pathname === '/abilities') {
      return paginer(res, abilities, url);
    }

    const detail = url.pathname.match(/^\/datasheets\/([\w-]+)$/);
    if (detail) {
      const sheet = datasheets.find((entry) => entry.id === detail[1]);
      return sheet
        ? send(res, 200, sheet)
        : send(res, 404, { detail: `Aucun datasheet avec l id ${detail[1]}` });
    }

    if (url.pathname === '/datasheets') {
      const query = (url.searchParams.get('q') ?? '').trim().toLowerCase();
      const items = (query ? datasheets.filter((sheet) => score(query, sheet.name) >= 20) : datasheets).map(
        (sheet) => ({
          id: sheet.id,
          name: sheet.name,
          faction: sheet.faction,
          role: sheet.role,
          cost_min: sheet.cost_min,
          link: sheet.link
        })
      );
      return paginer(res, items, url);
    }

    return send(res, 404, { detail: 'route inconnue' });
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const { port: actual } = server.address();
      resolve({
        url: `http://127.0.0.1:${actual}`,
        close: () => new Promise((done) => server.close(done))
      });
    });
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { url } = await startServer({ port: Number(process.env.PORT ?? 8787) });
  process.stdout.write(`Warhadex mock API sur ${url}\n`);
}
