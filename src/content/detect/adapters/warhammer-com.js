// SPA React sans JSON-LD Product ni h1 sur la fiche produit
// le titre est porte par un h2 avec un attribut de test dedie
const SELECTORS = [
  '[data-testid="hero-product-card-name"]',
  'h2[class*="ProductName"]',
  'main h1'
];

export default {
  id: 'warhammer-com',
  match: (url) => /(^|\.)warhammer\.com$/.test(new URL(url).hostname),
  extract(doc) {
    for (const selector of SELECTORS) {
      const text = doc.querySelector(selector)?.textContent?.trim();
      if (text) return { raw: text, source: `adapter:warhammer-com:${selector}` };
    }
    return null;
  }
};
