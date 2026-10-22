/**
 * @file Kleine Statusanzeige für die Live-Verbindung (grün/gelb/rot).
 */

import { el } from '../core/dom.js';

/** Texte pro Status. */
const LABELS = {
  connecting: 'Verbinde …',
  online: 'Live',
  offline: 'Keine Verbindung',
};

/**
 * Erstellt die Statusanzeige.
 *
 * @returns {{ element: HTMLElement, setStatus: (status: 'connecting'|'online'|'offline') => void }}
 */
export function createConnectionBadge() {
  const label = el('span', { class: 'conn__label' });
  const element = el('span', { class: 'conn', role: 'status' }, el('span', { class: 'conn__dot' }), label);

  /**
   * Setzt den angezeigten Status.
   * @param {'connecting'|'online'|'offline'} status
   */
  function setStatus(status) {
    element.dataset.status = status;
    label.textContent = LABELS[status] ?? status;
  }

  setStatus('connecting');
  return { element, setStatus };
}
