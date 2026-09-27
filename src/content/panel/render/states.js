import { el } from './el.js';
import { STATUS } from '../../../core/messages.js';
import { t } from '../../../core/i18n.js';

const MESSAGES = {
  [STATUS.NOT_FOUND]: 'stateNotFound',
  [STATUS.NOT_CONFIGURED]: 'stateNotConfigured',
  [STATUS.OFFLINE]: 'stateOffline',
  [STATUS.AMBIGUOUS]: 'stateAmbiguous',
  [STATUS.ERROR]: 'stateError'
};

export function renderState(doc, status) {
  return el(doc, 'p', { class: 'wx-state' }, t(MESSAGES[status] ?? MESSAGES[STATUS.ERROR]));
}
