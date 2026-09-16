import browser from '../../vendor/browser.js';
import { STATUS } from '../../core/messages.js';
import { el } from './render/el.js';
import { renderDatasheet } from './render/datasheet.js';
import { renderWeapons } from './render/weapons.js';
import { renderAbilities } from './render/abilities.js';
import { renderLore } from './render/lore.js';
import { renderSource } from './render/source.js';
import { renderState } from './render/states.js';
import { createHome } from './render/home.js';
import { LOGOS } from './logos.js';

async function loadStyles(doc) {
  const style = doc.createElement('style');
  const url = browser.runtime.getURL('content/panel/panel.css');
  try {
    style.textContent = await (await fetch(url)).text();
  } catch {
    // Le panneau doit tout de meme s afficher, meme sans sa feuille de style
    style.textContent = '';
  }
  return style;
}

export async function createPanel({ doc, onSelect, onSearch }) {
  const host = doc.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });

  const root = el(doc, 'div', { class: 'wx-root', 'data-open': 'false' });
  const close = el(doc, 'button', { class: 'wx-close', type: 'button', 'aria-label': 'Fermer' }, 'x');
  const marque = el(
    doc,
    'div',
    { class: 'wx-brand' },
    el(doc, 'img', {
      class: 'wx-brand-logo',
      src: browser.runtime.getURL(LOGOS.marque),
      alt: '',
      width: 40,
      height: 40
    }),
    el(doc, 'span', { class: 'wx-brand-name' }, 'Warhadex')
  );
  const nav = el(doc, 'div', { class: 'wx-nav' });
  const tabs = el(doc, 'div', { class: 'wx-tabs', role: 'tablist' });
  const body = el(doc, 'div', { class: 'wx-body' });

  root.append(close, marque, nav, tabs, body);
  shadow.append(await loadStyles(doc), root);
  doc.body.append(host);

  const open = () => root.setAttribute('data-open', 'true');
  const closePanel = () => root.setAttribute('data-open', 'false');

  const onKeydown = (event) => {
    if (event.key === 'Escape') closePanel();
  };

  close.addEventListener('click', closePanel);
  doc.addEventListener('keydown', onKeydown);

  const home = onSearch
    ? createHome(doc, { onSelect, onSearch, filigraneUrl: browser.runtime.getURL(LOGOS.filigrane) })
    : null;
  // l accueil n existe que si une detection a eu lieu sur cette page
  let accueilPret = false;

  const retour = el(doc, 'button', { class: 'wx-back', type: 'button' }, 'Retour a la recherche');
  retour.addEventListener('click', () => showHome());

  function showSections(sections) {
    body.replaceChildren(...sections.filter(Boolean));
  }

  function showHome(status) {
    if (!home) return;
    nav.replaceChildren();
    tabs.replaceChildren();
    home.setMessage(status ? renderState(doc, status).textContent : '');
    showSections([home.node]);
  }

  function buildTabs(entries) {
    tabs.replaceChildren();
    if (entries.length < 2) return;

    for (const [index, entry] of entries.entries()) {
      const tab = el(
        doc,
        'button',
        { class: 'wx-tab', type: 'button', role: 'tab', 'aria-selected': String(index === 0) },
        entry.label
      );
      tab.addEventListener('click', () => {
        for (const other of tabs.children) other.setAttribute('aria-selected', 'false');
        tab.setAttribute('aria-selected', 'true');
        showSections(entry.sections());
      });
      tabs.append(tab);
    }
  }

  return {
    open,
    close: closePanel,

    // vide le panneau sans le detruire : pendant une navigation SPA le contenu
    // precedent ne doit plus etre reouvrable
    clear() {
      accueilPret = false;
      home?.arreter();
      home?.setMatches([]);
      home?.setMessage('');
      nav.replaceChildren();
      tabs.replaceChildren();
      body.replaceChildren();
    },

    // memorise ce que la detection a trouve, sans l afficher
    setHome(matches) {
      if (!home) return;
      accueilPret = true;
      home.setMatches(matches ?? []);
    },

    showHome,

    destroy: () => {
      doc.removeEventListener('keydown', onKeydown);
      home?.arreter();
      host.remove();
    },

    showCharacter(character) {
      const regles = () => [
        renderDatasheet(doc, character),
        renderWeapons(doc, character.weapons),
        renderAbilities(doc, character),
        renderSource(doc, character)
      ];
      const histoire = () => [renderLore(doc, character)];

      const entries = [{ label: 'Regles', sections: regles }];
      if (character.lore || character.books?.length) entries.push({ label: 'Histoire', sections: histoire });

      // depuis une fiche on doit pouvoir revenir choisir, notamment sur une boite
      // contenant plusieurs types de figurines
      nav.replaceChildren(...(accueilPret ? [retour] : []));
      buildTabs(entries);
      showSections(regles());
    },

    showState(status) {
      nav.replaceChildren();
      tabs.replaceChildren();
      showSections([renderState(doc, status)]);
    },

    showMatches(matches) {
      if (!home) {
        nav.replaceChildren();
        tabs.replaceChildren();
        showSections([renderState(doc, STATUS.AMBIGUOUS)]);
        return;
      }
      accueilPret = true;
      home.setMatches(matches);
      showHome(STATUS.AMBIGUOUS);
    }
  };
}
