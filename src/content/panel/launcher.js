const STYLE = `
:host { all: initial; }
.wx-launcher {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2147483646;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 999px;
  color: #e2e8f0;
  cursor: pointer;
  font: 13px/1 system-ui, -apple-system, Segoe UI, sans-serif;
  padding: 10px 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
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
