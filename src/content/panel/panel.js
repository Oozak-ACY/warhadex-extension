import browser from '../../vendor/browser.js';
import { STATUS } from '../../core/messages.js';
import { el } from './render/el.js';
import { renderDatasheet } from './render/datasheet.js';
import { renderWeapons } from './render/weapons.js';
import { renderAbilities } from './render/abilities.js';
import { renderLore } from './render/lore.js';
import { renderState } from './render/states.js';

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

export async function createPanel({ doc, onSelect }) {
  const host = doc.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });

  const root = el(doc, 'div', { class: 'wx-root', 'data-open': 'false' });
  const close = el(doc, 'button', { class: 'wx-close', type: 'button', 'aria-label': 'Fermer' }, 'x');
  const tabs = el(doc, 'div', { class: 'wx-tabs', role: 'tablist' });
  const body = el(doc, 'div', { class: 'wx-body' });

  root.append(close, tabs, body);
  shadow.append(await loadStyles(doc), root);
  doc.body.append(host);

  const open = () => root.setAttribute('data-open', 'true');
  const closePanel = () => root.setAttribute('data-open', 'false');

  const onKeydown = (event) => {
    if (event.key === 'Escape') closePanel();
  };

  close.addEventListener('click', closePanel);
  doc.addEventListener('keydown', onKeydown);

  function showSections(sections) {
    body.replaceChildren(...sections.filter(Boolean));
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
    destroy: () => {
      doc.removeEventListener('keydown', onKeydown);
      host.remove();
    },

    showCharacter(character) {
      const regles = () => [
        renderDatasheet(doc, character),
        renderWeapons(doc, character.weapons),
        renderAbilities(doc, character)
      ];
      const histoire = () => [renderLore(doc, character)];

      const entries = [{ label: 'Regles', sections: regles }];
      if (character.lore || character.books?.length) entries.push({ label: 'Histoire', sections: histoire });

      buildTabs(entries);
      showSections(regles());
    },

    showState(status) {
      tabs.replaceChildren();
      showSections([renderState(doc, status)]);
    },

    showMatches(matches) {
      tabs.replaceChildren();
      const boutons = matches.map((match) => {
        const bouton = el(
          doc,
          'button',
          { class: 'wx-match', type: 'button' },
          `${match.name} - ${match.faction ?? ''}`
        );
        bouton.addEventListener('click', () => onSelect(match.id));
        return bouton;
      });
      showSections([el(doc, 'div', {}, renderState(doc, STATUS.AMBIGUOUS), ...boutons)]);
    }
  };
}
