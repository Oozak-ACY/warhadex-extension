import { t } from '../../core/i18n.js';

// memes valeurs que la palette heraldique de panel.css : le lanceur vit dans son
// propre Shadow DOM et ne voit pas ses variables
const STYLE = `
:host { all: initial; }
.wx-launcher {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2147483646;
  background: #9b1c1c;
  border: 2px solid #f7f2e8;
  border-radius: 3px;
  color: #f7f2e8;
  cursor: pointer;
  font: 600 13px/1 'Warhadex Cinzel', 'Cinzel', 'Trajan Pro', 'Times New Roman', Georgia, serif;
  letter-spacing: 0.5px;
  padding: 10px 16px;
  box-shadow: 0 4px 12px rgba(42, 26, 20, 0.35);
}
.wx-launcher.wx-avec-logo {
  align-items: center;
  display: inline-flex;
  gap: 8px;
  padding: 5px 14px 5px 6px;
}
.wx-launcher-logo { display: block; height: 28px; width: 28px; }
.wx-launcher:hover { background: #7f1616; }
.wx-launcher:focus-visible { outline: 2px solid #2a1a14; outline-offset: 2px; }
.wx-launcher[hidden] { display: none; }
`;

export function createLauncher({ doc, onClick, iconUrl }) {
  const host = doc.createElement('div');
  const root = host.attachShadow({ mode: 'open' });

  const style = doc.createElement('style');
  style.textContent = STYLE;

  const button = doc.createElement('button');
  button.className = 'wx-launcher';
  button.type = 'button';
  if (iconUrl) {
    // decoratif : le libelle du bouton porte deja le sens
    const logo = doc.createElement('img');
    logo.className = 'wx-launcher-logo';
    logo.src = iconUrl;
    logo.alt = '';
    button.classList.add('wx-avec-logo');
    button.append(logo);
  }
  button.append(doc.createTextNode(t('launcherLabel')));
  button.hidden = true;
  button.addEventListener('click', onClick);

  root.append(style, button);
  doc.body.append(host);

  return {
    show: () => {
      button.hidden = false;
    },
    hide: () => {
      button.hidden = true;
    },
    destroy: () => host.remove()
  };
}
