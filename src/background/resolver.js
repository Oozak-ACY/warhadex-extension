import { ApiError } from '../core/api-client.js';
import { MSG, STATUS } from '../core/messages.js';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const NEGATIVE_TTL_MS = DAY_MS;
export const CERTAIN_SCORE = 0.8;

// Spec section 5 : une correspondance est certaine si elle est unique et que son
// score depasse 0.8. Conjonction stricte : montrer le mauvais personnage avec
// assurance est un echec plus grave qu un selecteur a une seule entree
function estCertaine(matches) {
  return matches.length === 1 && matches[0].score > CERTAIN_SCORE;
}

export function toFailure(error) {
  if (error instanceof ApiError) {
    if (error.status === 'not-configured') return { status: STATUS.NOT_CONFIGURED };
    if (error.status === 'offline') return { status: STATUS.OFFLINE };
    if (error.status === 'not-found') return { status: STATUS.NOT_FOUND };
  }
  return { status: STATUS.ERROR };
}

// messages dont la reponse pilote le badge de l onglet emetteur
export const BADGE_MESSAGES = new Set([MSG.RESOLVE, MSG.CLEAR_BADGE]);

export function badgeState(status) {
  if (status === STATUS.MATCH) return 'match';
  if (status === STATUS.AMBIGUOUS) return 'ambiguous';
  return 'none';
}

export function createResolver({ api, cache, getSettings }) {
  async function ficheTtl() {
    const { cacheTtlDays } = await getSettings();
    return Math.max(1, Number(cacheTtlDays) || 7) * DAY_MS;
  }

  async function loadCharacter(id) {
    const cached = await cache.get(`character:${id}`);
    if (cached !== undefined) return cached;

    const character = await api.character(id);
    await cache.set(`character:${id}`, character, await ficheTtl());
    return character;
  }

  async function resolveName(name, site) {
    const key = `resolve:${name}`;
    let matches = await cache.get(key);

    if (matches === undefined) {
      matches = await api.resolve(name, site);
      // cache negatif court : ne pas solliciter le serveur sur chaque page sans personnage
      await cache.set(key, matches, matches.length ? await ficheTtl() : NEGATIVE_TTL_MS);
    }

    if (!matches.length) return { status: STATUS.NOT_FOUND };

    if (estCertaine(matches)) {
      return { status: STATUS.MATCH, character: await loadCharacter(matches[0].id) };
    }
    return { status: STATUS.AMBIGUOUS, matches };
  }

  async function handle(message) {
    if (message.type === MSG.RESOLVE) return resolveName(message.name, message.site);
    // le content script quitte une page produit : Chrome ne reinitialise le badge
    // d un onglet que sur une vraie navigation, pas sur un changement d URL SPA
    if (message.type === MSG.CLEAR_BADGE) return { status: STATUS.NOT_FOUND };
    if (message.type === MSG.CHARACTER) {
      return { status: STATUS.MATCH, character: await loadCharacter(message.id) };
    }
    if (message.type === MSG.CLEAR_CACHE) {
      await cache.clear();
      return { status: STATUS.MATCH };
    }
    return { status: STATUS.ERROR };
  }

  return { handle, resolveName, loadCharacter };
}
