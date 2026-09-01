import browser from '../vendor/browser.js';

const STYLES = {
  match: { text: '1', color: '#166534' },
  ambiguous: { text: '?', color: '#92400e' },
  none: { text: '', color: '#000000' }
};

export function createBadge(action) {
  return async function setBadge(tabId, state) {
    const style = STYLES[state] ?? STYLES.none;
    try {
      await action.setBadgeText({ tabId, text: style.text });
      await action.setBadgeBackgroundColor({ tabId, color: style.color });
    } catch {
      // l onglet peut avoir disparu entre la detection et la mise a jour
    }
  };
}

// optional chaining avoids a crash on import outside an extension context (e.g. tests)
export const setBadge = createBadge(browser?.action ?? {});
