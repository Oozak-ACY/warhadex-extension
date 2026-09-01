const NOISE = [
  /warhammer\s*40[.,]?\s*000/gi,
  /warhammer\s*40k/gi,
  /\bcitadel\b/gi,
  /\bgames\s*workshop\b/gi,
  /\bminiatures?\b/gi,
  /\bfigurines?\b/gi,
  /\bboxed\b/gi,
  /\bboite\b/gi,
  /\bbox\b/gi,
  /\bset\b/gi,
  /\b\d{2}-\d{2,3}\b/g,
  /\((?:fr|en|de|es|it|pl)\)/gi
];

export function normalize(raw) {
  if (typeof raw !== 'string') return '';

  let value = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  for (const pattern of NOISE) {
    value = value.replace(pattern, ' ');
  }

  return value
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
