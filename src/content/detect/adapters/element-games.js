// boutique Magento, titre reel dans le h1 du bloc page-title
// pas de itemprop=name ni de JSON-LD Product sur la fiche
const SELECTORS = ['.product-page-title h1', 'h1.product-page', 'main h1'];

export default {
  id: 'element-games',
  match: (url) => /(^|\.)elementgames\.co\.uk$/.test(new URL(url).hostname),
  extract(doc) {
    for (const selector of SELECTORS) {
      const text = doc.querySelector(selector)?.textContent?.trim();
      if (text) return { raw: text, source: `adapter:element-games:${selector}` };
    }
    return null;
  }
};
