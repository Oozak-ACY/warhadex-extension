import { el } from './el.js';

export const MIN_CARACTERES = 4;
export const MAX_RESULTATS = 5;
const ANTI_REBOND_MS = 250;

function ligne(doc, match, onSelect) {
  const bouton = el(
    doc,
    'button',
    { class: 'wx-match', type: 'button' },
    [match.name, match.faction].filter(Boolean).join(' - ')
  );
  bouton.addEventListener('click', () => onSelect(match.id));
  return bouton;
}

export function createHome(
  doc,
  {
    onSelect,
    onSearch,
    filigraneUrl,
    minCaracteres = MIN_CARACTERES,
    maxResultats = MAX_RESULTATS,
    antiRebondMs = ANTI_REBOND_MS
  }
) {
  const champ = el(doc, 'input', {
    class: 'wx-search',
    type: 'search',
    placeholder: 'Chercher un personnage',
    'aria-label': 'Chercher un personnage',
    autocomplete: 'off',
    spellcheck: 'false'
  });
  const message = el(doc, 'p', { class: 'wx-home-message' });
  const liste = el(doc, 'div', { class: 'wx-home-list' });
  // la CSS ne l affiche que tant que la liste est vide, pour habiller l accueil
  const filigrane = filigraneUrl
    ? el(doc, 'img', { class: 'wx-filigrane', src: filigraneUrl, alt: '', 'aria-hidden': 'true' })
    : null;
  const node = el(doc, 'div', { class: 'wx-home' }, champ, message, liste, filigrane);

  const fenetre = doc.defaultView;
  let timer = null;
  // les reponses arrivent dans le desordre : une requete lente lancee avant une
  // rapide ecraserait le resultat le plus recent
  let sequence = 0;

  function setMessage(texte) {
    message.textContent = texte ?? '';
  }

  function setMatches(matches) {
    const visibles = (matches ?? []).slice(0, maxResultats);
    liste.replaceChildren(...visibles.map((match) => ligne(doc, match, onSelect)));
  }

  async function chercher(requete) {
    const jeton = (sequence += 1);
    setMessage('Recherche en cours');

    let resultats;
    try {
      resultats = await onSearch(requete);
    } catch {
      if (jeton === sequence) setMessage('Recherche impossible');
      return;
    }

    if (jeton !== sequence) return;

    setMatches(resultats);
    if (!resultats?.length) setMessage('Aucun personnage a ce nom');
    else if (resultats.length > maxResultats) setMessage(`${maxResultats} premiers resultats`);
    else setMessage('');
  }

  champ.addEventListener('input', () => {
    fenetre.clearTimeout(timer);
    const requete = champ.value.trim();

    if (requete.length < minCaracteres) {
      // toute frappe invalide la reponse en vol
      sequence += 1;
      setMatches([]);
      setMessage(requete ? `Au moins ${minCaracteres} caracteres` : '');
      return;
    }

    timer = fenetre.setTimeout(() => chercher(requete), antiRebondMs);
  });

  // Beaucoup de marchands ecoutent le clavier au niveau du document : sans cela
  // taper une lettre ouvrirait leur propre recherche par dessus le panneau.
  // Echap reste laissee passer, c est elle qui ferme le panneau
  for (const type of ['keydown', 'keyup', 'keypress']) {
    champ.addEventListener(type, (event) => {
      if (event.key !== 'Escape') event.stopPropagation();
    });
  }

  return {
    node,
    setMatches,
    setMessage,
    focus: () => champ.focus(),
    arreter: () => fenetre.clearTimeout(timer)
  };
}
