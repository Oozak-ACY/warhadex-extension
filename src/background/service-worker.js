import browser from '../vendor/browser.js';
import { cache } from '../core/cache.js';
import { getSettings } from '../core/settings.js';
import { createApiClient, ApiError } from '../core/api-client.js';
import { MSG, STATUS } from '../core/messages.js';
import { setBadge } from './badge.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const NEGATIVE_TTL_MS = DAY_MS;
const CERTAIN_SCORE = 0.8;

const api = createApiClient({ getSettings });

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
    await cache.set(key, matches, matches.length ? await ficheTtl() : NEGATIVE_TTL_MS);
  }

  if (!matches.length) return { status: STATUS.NOT_FOUND };

  const [best] = matches;
  if (matches.length === 1 || best.score >= CERTAIN_SCORE) {
    return { status: STATUS.MATCH, character: await loadCharacter(best.id) };
  }
  return { status: STATUS.AMBIGUOUS, matches };
}

function toFailure(error) {
  if (error instanceof ApiError) {
    if (error.status === 'not-configured') return { status: STATUS.NOT_CONFIGURED };
    if (error.status === 'offline') return { status: STATUS.OFFLINE };
    if (error.status === 'not-found') return { status: STATUS.NOT_FOUND };
  }
  return { status: STATUS.ERROR };
}

async function handle(message) {
  if (message.type === MSG.RESOLVE) return resolveName(message.name, message.site);
  if (message.type === MSG.CHARACTER) {
    return { status: STATUS.MATCH, character: await loadCharacter(message.id) };
  }
  if (message.type === MSG.CLEAR_CACHE) {
    await cache.clear();
    return { status: STATUS.MATCH };
  }
  return { status: STATUS.ERROR };
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handle(message)
    .catch(toFailure)
    .then(async (result) => {
      if (sender.tab?.id != null && message.type === MSG.RESOLVE) {
        const state =
          result.status === STATUS.MATCH
            ? 'match'
            : result.status === STATUS.AMBIGUOUS
              ? 'ambiguous'
              : 'none';
        await setBadge(sender.tab.id, state);
      }
      sendResponse(result);
    });

  return true;
});

browser.action.onClicked.addListener(() => browser.runtime.openOptionsPage());
