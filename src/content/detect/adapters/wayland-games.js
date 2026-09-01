// boutique Next.js (pas Shopify), classes CSS-modules hashees
// on cible le prefixe stable plutot que le suffixe de hash genere au build
const SELECTORS = ['h1[class*="ProductInfo_detailTitle"]', 'h1[class*="PageTitle_title"]', 'main h1'];

export default {
  id: 'wayland-games',
  match: (url) => /(^|\.)waylandgames\.co\.uk$/.test(new URL(url).hostname),
  extract(doc) {
    for (const selector of SELECTORS) {
      const text = doc.querySelector(selector)?.textContent?.trim();
      if (text) return { raw: text, source: `adapter:wayland-games:${selector}` };
    }
    return null;
  }
};
