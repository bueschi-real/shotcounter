/**
 * @file Kurze Rückmeldungen am unteren Bildschirmrand ("Toasts").
 *
 * Optional mit einer Aktionsschaltfläche, z. B. "Rückgängig".
 * Benötigt im HTML ein Element `<div id="toasts">`.
 */

import { el } from '../core/dom.js';

/**
 * @typedef {object} ToastOptions
 * @property {'info'|'success'|'error'} [type='info'] Farbe/Art der Meldung.
 * @property {number} [durationMs=4000] Anzeigedauer.
 * @property {{ label: string, onClick: () => void }} [action] Optionale Schaltfläche.
 */

/**
 * Zeigt eine Meldung an.
 *
 * @param {string} message Text der Meldung.
 * @param {ToastOptions} [options]
 * @returns {() => void} Funktion, um die Meldung vorzeitig zu schliessen.
 */
export function showToast(message, { type = 'info', durationMs = 4000, action } = {}) {
  const container = document.getElementById('toasts');
  if (!container) return () => {};

  const toast = el(
    'div',
    { class: `toast toast--${type}`, role: type === 'error' ? 'alert' : 'status' },
    el('span', { class: 'toast__text' }, message),
    action &&
      el(
        'button',
        {
          class: 'toast__action',
          type: 'button',
          onclick: () => {
            dismiss();
            action.onClick();
          },
        },
        action.label
      )
  );

  let removed = false;

  /** Blendet die Meldung aus und entfernt sie. */
  function dismiss() {
    if (removed) return;
    removed = true;
    toast.classList.add('toast--leaving');
    setTimeout(() => toast.remove(), 250);
  }

  // Zu viele gleichzeitige Meldungen vermeiden: max. 3 sichtbar
  while (container.children.length >= 3) container.firstElementChild.remove();

  container.append(toast);
  setTimeout(dismiss, durationMs);
  return dismiss;
}
