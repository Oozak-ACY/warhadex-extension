import { CLE_API_PAR_DEFAUT } from './config.js';

export class ApiError extends Error {
  constructor(status, message, retryAfter, options) {
    super(message, options);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

function mapHttpError(response) {
  // cle absente, invalide ou revoquee : l acces est refuse, ce n est pas une panne
  if (response.status === 401 || response.status === 403) {
    return new ApiError('not-configured', 'cle d api refusee');
  }
  if (response.status === 404) return new ApiError('not-found', 'fiche inconnue');
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('retry-after')) || undefined;
    return new ApiError('rate-limited', 'quota depasse', retryAfter);
  }
  return new ApiError('error', `reponse ${response.status}`);
}

// L extension ne parle qu a cette API, avec la cle integree au build : ni l adresse
// ni la cle ne sont des reglages, et rien n est lu dans le stockage. Les parametres
// ne servent qu aux tests
export const URL_API = 'https://warhadex-api.orion-sphere.fr';

export function createApiClient({ fetchImpl = fetch, baseUrl = URL_API, apiKey = CLE_API_PAR_DEFAUT } = {}) {
  async function request(path, params) {
    if (!baseUrl) throw new ApiError('not-configured', 'url d api absente');

    let url;
    try {
      url = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
    } catch (err) {
      throw new ApiError('not-configured', 'url d api invalide', undefined, { cause: err });
    }
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value) url.searchParams.set(key, value);
    }

    const headers = { Accept: 'application/json' };
    if (apiKey) headers['X-API-Key'] = apiKey;

    let response;
    try {
      response = await fetchImpl(url, { headers, credentials: 'omit' });
    } catch (err) {
      throw new ApiError('offline', 'api injoignable', undefined, { cause: err });
    }

    if (!response.ok) throw mapHttpError(response);

    try {
      return await response.json();
    } catch {
      throw new ApiError('error', 'reponse illisible');
    }
  }

  return {
    // /search porte un score, contrairement a /datasheets?q=, et le score pilote
    // la regle de certitude. Les scores de l API sont sur 100
    async resolve(name) {
      const body = await request('search', { q: name, type: 'datasheet', limit: '5' });
      const items = Array.isArray(body?.items) ? body.items : [];
      return items.map((item) => ({
        id: item.id,
        name: item.name,
        score: Number(item.score) / 100
      }));
    },

    // /search ne rend pas la faction, indispensable pour departager deux
    // datasheets homonymes. /datasheets?q= la porte, au prix d un appel de plus
    async describe(name) {
      const body = await request('datasheets', { q: name, limit: '5' });
      const items = Array.isArray(body?.items) ? body.items : [];
      return items.map((item) => ({ id: item.id, faction: item.faction?.name ?? '' }));
    },

    character(id) {
      return request(`datasheets/${encodeURIComponent(id)}`);
    },

    // les aptitudes Core et Faction arrivent vides sur une datasheet, avec un
    // ability_id a resoudre. Le referentiel entier tient en un appel
    async abilities() {
      const body = await request('abilities', { limit: '200' });
      return Array.isArray(body?.items) ? body.items : [];
    }
  };
}
