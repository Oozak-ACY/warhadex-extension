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
  font: 600 13px/1 'Cinzel', 'Trajan Pro', 'Times New Roman', Georgia, serif;
  letter-spacing: 0.5px;
  padding: 10px 16px;
  box-shadow: 0 4px 12px rgba(42, 26, 20, 0.35);
}
.wx-launcher:hover { background: #7f1616; }
.wx-launcher:focus-visible { outline: 2px solid #2a1a14; outline-offset: 2px; }
.wx-launcher[hidden] { display: none; }
`;

export function createLauncher({ doc, onClick }) {
  const host = doc.createElement('div');
  const root = host.attachShadow({ mode: 'open' });

  const style = doc.createElement('style');
  style.textContent = STYLE;

  const button = doc.createElement('button');
  button.className = 'wx-launcher';
  button.type = 'button';
  button.textContent = 'Voir les regles';
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
