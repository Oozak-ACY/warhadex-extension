// Un content script s execute dans un monde isole : il partage le DOM avec la
// page mais pas ses globales. Patcher history.pushState depuis ce monde
// n intercepte donc pas les appels du routeur de la page, qui vivent dans le
// monde principal, et une navigation SPA passe totalement inapercue.
// Comparer periodiquement location.href est le seul moyen fiable sur les trois
// moteurs sans injecter de script dans la page.
const INTERVALLE_MS = 400;

export function observeUrlChanges(win, callback, intervalMs = INTERVALLE_MS) {
  let derniere = win.location.href;

  const verifier = () => {
    if (win.location.href === derniere) return;
    derniere = win.location.href;
    callback(derniere);
  };

  const timer = win.setInterval(verifier, intervalMs);
  // popstate ne couvre que les retours arriere, mais il evite d attendre le tick
  win.addEventListener('popstate', verifier);

  return () => {
    win.clearInterval(timer);
    win.removeEventListener('popstate', verifier);
  };
}
