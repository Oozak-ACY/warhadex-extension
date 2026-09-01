// confirme en production : titre porte par #product-title
// pas de itemprop=name sur le h1
const SELECTORS = ['#product-title', 'h1.product-title', 'main h1'];

export default {
  id: 'philibert',
  match: (url) => /(^|\.)philibertnet\.com$/.test(new URL(url).hostname),
  extract(doc) {
    for (const selector of SELECTORS) {
      const text = doc.querySelector(selector)?.textContent?.trim();
      if (text) return { raw: text, source: `adapter:philibert:${selector}` };
    }
    return null;
  }
};
