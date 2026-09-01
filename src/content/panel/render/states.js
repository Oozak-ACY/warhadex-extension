import { el } from './el.js';
import { STATUS } from '../../../core/messages.js';

const MESSAGES = {
  [STATUS.NOT_FOUND]: 'Aucun personnage reconnu sur cette page',
  [STATUS.NOT_CONFIGURED]: 'Renseignez l adresse de votre API dans les options de Warhadex',
  [STATUS.OFFLINE]: 'Votre API est injoignable',
  [STATUS.AMBIGUOUS]: 'Plusieurs personnages correspondent',
  [STATUS.ERROR]: 'Une erreur est survenue lors de la recuperation de la fiche'
};

export function renderState(doc, status) {
  return el(doc, 'p', { class: 'wx-state' }, MESSAGES[status] ?? MESSAGES[STATUS.ERROR]);
}
