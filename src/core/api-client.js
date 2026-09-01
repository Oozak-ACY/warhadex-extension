export class ApiError extends Error {
  constructor(status, message, retryAfter, options) {
    super(message, options);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

function mapHttpError(response) {
  if (response.status === 404) return new ApiError('not-found', 'fiche inconnue');
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('retry-after')) || undefined;
    return new ApiError('rate-limited', 'quota depasse', retryAfter);
  }
  return new ApiError('error', `reponse ${response.status}`);
}

export function createApiClient({ getSettings, fetchImpl = fetch }) {
  async function request(path, params) {
    const { apiBaseUrl, apiKey } = await getSettings();
    if (!apiBaseUrl) throw new ApiError('not-configured', 'url d api non reglee');

    let url;
    try {
      url = new URL(path, apiBaseUrl.endsWith('/') ? apiBaseUrl : `${apiBaseUrl}/`);
    } catch (err) {
      throw new ApiError('not-configured', 'url d api invalide', undefined, { cause: err });
    }
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value) url.searchParams.set(key, value);
    }

    const headers = { Accept: 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

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
    async resolve(name, site) {
      const body = await request('v1/resolve', { q: name, site });
      return Array.isArray(body?.matches) ? body.matches : [];
    },

    character(id) {
      return request(`v1/characters/${encodeURIComponent(id)}`);
    }
  };
}
