// games-workshop.com redirige integralement vers warhammer.com en production
// selecteurs non verifies, conserves pour une eventuelle URL indexee restante
const SELECTORS = ['h1.product-name', '[itemprop="name"]', 'main h1'];

export default {
  id: 'games-workshop-store',
  match: (url) => /(^|\.)games-workshop\.com$/.test(new URL(url).hostname),
  extract(doc) {
    for (const selector of SELECTORS) {
      const text = doc.querySelector(selector)?.textContent?.trim();
      if (text) return { raw: text, source: `adapter:games-workshop-store:${selector}` };
    }
    return null;
  }
};
