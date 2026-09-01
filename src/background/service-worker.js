import browser from '../vendor/browser.js';
import { cache } from '../core/cache.js';
import { getSettings } from '../core/settings.js';
import { createApiClient } from '../core/api-client.js';
import { MSG } from '../core/messages.js';
import { createResolver, toFailure, badgeState } from './resolver.js';
import { setBadge } from './badge.js';

const api = createApiClient({ getSettings });
const { handle } = createResolver({ api, cache, getSettings });

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handle(message)
    .catch(toFailure)
    .then(async (result) => {
      if (sender.tab?.id != null && message.type === MSG.RESOLVE) {
        await setBadge(sender.tab.id, badgeState(result.status));
      }
      sendResponse(result);
    });

  return true;
});

browser.action.onClicked.addListener(() => browser.runtime.openOptionsPage());
