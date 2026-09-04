function flatten(node) {
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (node && typeof node === 'object') {
    return node['@graph'] ? [node, ...flatten(node['@graph'])] : [node];
  }
  return [];
}

function isProduct(node) {
  const type = node['@type'];
  return Array.isArray(type) ? type.includes('Product') : type === 'Product';
}

function fromJsonLd(doc) {
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    let parsed;
    try {
      parsed = JSON.parse(script.textContent);
    } catch {
      continue;
    }
    const product = flatten(parsed).find((node) => isProduct(node) && typeof node.name === 'string');
    if (product) return { raw: product.name.trim(), source: 'jsonld' };
  }
  return null;
}

function fromMeta(doc) {
  const content = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
  return content?.trim() ? { raw: content.trim(), source: 'og' } : null;
}

function fromHeading(doc) {
  const text = doc.querySelector('h1')?.textContent;
  return text?.trim() ? { raw: text.trim(), source: 'heading' } : null;
}

export function extractGeneric(doc) {
  return fromJsonLd(doc) ?? fromMeta(doc) ?? fromHeading(doc);
}
