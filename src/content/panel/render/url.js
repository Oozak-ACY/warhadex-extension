// tout ce qui vient de l API est non fiable : seuls http et https deviennent
// des liens cliquables, le reste est rendu en texte brut
const SAFE_URL = /^https?:\/\//i;

export function isSafeUrl(url) {
  return typeof url === 'string' && SAFE_URL.test(url);
}
