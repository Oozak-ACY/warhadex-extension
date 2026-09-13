// Chrome ignore les regles @font-face declarees dans un Shadow DOM : les polices du
// panneau sont donc declarees une fois dans le document hote, ou les Shadow DOM du
// panneau et du lanceur les trouvent. Leurs noms sont propres a l extension pour ne
// jamais redefinir une police utilisee par le site marchand
export const POLICES = [
  { famille: 'Warhadex Cinzel', fichier: 'assets/fonts/cinzel.woff2' },
  { famille: 'Warhadex Garamond', fichier: 'assets/fonts/eb-garamond.woff2' }
];

const ID = 'warhadex-polices';

export function injecterPolices(doc, getURL) {
  if (doc.getElementById(ID)) return;

  const style = doc.createElement('style');
  style.id = ID;
  // fichiers variables : une seule source couvre les graisses 400 a 600
  style.textContent = POLICES.map(
    ({ famille, fichier }) =>
      `@font-face { font-family: '${famille}'; src: url('${getURL(fichier)}') format('woff2'); font-weight: 400 600; font-style: normal; font-display: swap; }`
  ).join(String.fromCharCode(10));

  (doc.head ?? doc.documentElement).append(style);
}
