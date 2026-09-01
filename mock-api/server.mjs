import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const characters = JSON.parse(
  await readFile(new URL('./data/characters.json', import.meta.url), 'utf8')
);

function score(query, alias) {
  if (query === alias) return 1;
  if (alias.includes(query) || query.includes(alias)) return 0.9;

  const queryTokens = new Set(query.split(' '));
  const aliasTokens = new Set(alias.split(' '));
  let shared = 0;
  for (const token of queryTokens) if (aliasTokens.has(token)) shared += 1;

  const union = new Set([...queryTokens, ...aliasTokens]).size;
  return union === 0 ? 0 : shared / union;
}

function resolve(query) {
  return characters
    .map((character) => ({
      character,
      score: Math.max(...character.aliases.map((alias) => score(query, alias)))
    }))
    .filter((entry) => entry.score >= 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ character, score: value }) => ({
      id: character.id,
      name: character.name,
      faction: character.faction,
      score: Number(value.toFixed(2))
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

export function startServer({ port = 8787 } = {}) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');

    if (url.pathname === '/v1/resolve') {
      const query = (url.searchParams.get('q') ?? '').trim();
      if (!query) return send(res, 400, { error: 'parametre q obligatoire' });
      return send(res, 200, { matches: resolve(query) });
    }

    const match = url.pathname.match(/^\/v1\/characters\/([\w-]+)$/);
    if (match) {
      const character = characters.find((entry) => entry.id === match[1]);
      return character
        ? send(res, 200, character)
        : send(res, 404, { error: 'fiche inconnue' });
    }

    return send(res, 404, { error: 'route inconnue' });
  });

  return new Promise((resolve_) => {
    server.listen(port, '127.0.0.1', () => {
      const { port: actual } = server.address();
      resolve_({
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
