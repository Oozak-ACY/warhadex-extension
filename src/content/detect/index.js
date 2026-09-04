import { findAdapter } from './registry.js';
import { extractGeneric } from './generic.js';
import { normalize } from './normalize.js';

export function detect(doc, url) {
  let site;
  try {
    site = new URL(url).hostname;
  } catch {
    return null;
  }

  const adapter = findAdapter(url);
  const extracted = adapter?.extract(doc) ?? extractGeneric(doc);
  if (!extracted) return null;

  const normalized = normalize(extracted.raw);
  if (!normalized) return null;

  return { raw: extracted.raw, normalized, site, source: extracted.source };
}
