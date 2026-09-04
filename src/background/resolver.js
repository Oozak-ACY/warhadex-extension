import { ApiError } from '../core/api-client.js';
import { indexAbilities, mapDatasheet } from '../core/datasheet-mapper.js';
import { MSG, STATUS } from '../core/messages.js';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const NEGATIVE_TTL_MS = DAY_MS;
// le referentiel d aptitudes ne bouge qu aux mises a jour de regles
export const ABILITIES_TTL_MS = 30 * DAY_MS;
// un titre marchand encadre souvent le nom de l unite par la faction ou la gamme,
// et l API n a pas de recherche approchante. Les marchands ne s accordent pas sur
// le cote : warhammer.com et Philibert prefixent, Wayland suffixe. On retente donc
// en retirant des mots des deux bouts
export const TRONCATURES_MAX = 3;

export function candidats(name) {
  const mots = name.split(' ').filter(Boolean);
  const liste = [name];

  for (let retires = 1; retires <= TRONCATURES_MAX && retires < mots.length; retires += 1) {
    liste.push(mots.slice(retires).join(' '));
    liste.push(mots.slice(0, mots.length - retires).join(' '));
  }

  return [...new Set(liste)];
}
export const CERTAIN_SCORE = 0.8;

// Une correspondance est certaine si son score depasse 0.8 et qu elle bat
// strictement la suivante. La spec exigeait l unicite, ce qui supposait une API
// ne rendant que de bons candidats ; celle-ci rend tout ce qui depasse un seuil
// bas, donc l unicite ferait apparaitre un selecteur sur presque chaque page.
// L intention de surete tient : deux candidats a egalite en tete restent ambigus
function estCertaine(matches) {
  if (!matches.length || matches[0].score <= CERTAIN_SCORE) return false;
  return matches.length === 1 || matches[0].score > matches[1].score;
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

  // Les aptitudes Core et Faction d une datasheet arrivent vides avec un
  // ability_id. Le referentiel entier tient en un appel, donc on le prend une
  // fois et on le garde
  async function abilityIndex() {
    const cached = await cache.get('abilities');
    if (cached !== undefined) return { index: indexAbilities(cached), complet: true };

    let items;
    try {
      items = await api.abilities();
    } catch {
      // referentiel injoignable : la fiche reste lisible, les aptitudes Core
      // s afficheront sans leur texte
      return { index: new Map(), complet: false };
    }

    await cache.set('abilities', items, ABILITIES_TTL_MS);
    return { index: indexAbilities(items), complet: true };
  }

  async function loadCharacter(id) {
    const cached = await cache.get(`character:${id}`);
    if (cached !== undefined) return cached;

    const aggregate = await api.character(id);
    const { index, complet } = await abilityIndex();
    const character = mapDatasheet(aggregate, index);

    // une fiche mappee sans referentiel est degradee : la garder une journee
    // seulement pour qu elle se repare d elle meme
    await cache.set(`character:${id}`, character, complet ? await ficheTtl() : NEGATIVE_TTL_MS);
    return character;
  }

  // On retient la meilleure tentative et non la premiere qui repond : retirer un
  // mot de plus fait souvent passer une correspondance approximative a exacte.
  // custodes custodian guard score 77 la ou custodian guard score 100, et
  // weirdboy orks score 76 la ou weirdboy score 100
  async function chercher(name) {
    let meilleur = { matches: [], requete: name, score: -1 };

    for (const requete of candidats(name)) {
      const matches = await api.resolve(requete);
      const score = matches.length ? matches[0].score : -1;

      if (score > meilleur.score) meilleur = { matches, requete, score };
      if (score >= 1) break;
    }

    return meilleur;
  }

  // l enrichissement est du confort d affichage, jamais une dependance
  async function enrichir(matches, requete) {
    try {
      const details = await api.describe(requete);
      const factions = new Map(details.map((detail) => [detail.id, detail.faction]));
      return matches.map((match) => ({ ...match, faction: factions.get(match.id) ?? '' }));
    } catch {
      return matches;
    }
  }

  async function resolveName(name) {
    const key = `resolve:${name}`;
    let matches = await cache.get(key);

    if (matches === undefined) {
      const trouve = await chercher(name);
      matches = trouve.matches;
      // des que le selecteur va s afficher, la faction est necessaire : sans elle
      // deux Terminator Squad sont indistinguables
      if (matches.length && !estCertaine(matches)) {
        matches = await enrichir(matches, trouve.requete);
      }
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
    if (message.type === MSG.RESOLVE) return resolveName(message.name);
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

  return { handle, resolveName, loadCharacter, abilityIndex, chercher };
}
