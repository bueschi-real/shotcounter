/**
 * @file Dialogfenster (Bestätigen, Texteingabe, PIN, Punkte-Ziffernblock).
 *
 * Alle Dialoge basieren auf dem HTML-Element `<dialog>` und liefern ein
 * Promise zurück. So lassen sie sich im Code einfach "abwarten":
 *
 *   const ok = await confirmDialog({ title: 'Löschen?', ... });
 *   if (ok) { ... }
 *
 * Neue Dialoge werden mit `openDialog()` gebaut (siehe Beispiele unten).
 */

import { el } from '../core/dom.js';
import { formatSigned } from '../core/format.js';

/**
 * @typedef {object} DialogAction
 * @property {string} label Beschriftung der Schaltfläche.
 * @property {'primary'|'secondary'|'danger'} [variant='secondary'] Darstellung.
 * @property {any} [value] Rückgabewert, wenn diese Schaltfläche gewählt wird.
 * @property {boolean} [isDefault] Wird bei Enter ausgelöst.
 * @property {() => any | Promise<any>} [onClick] Optionaler Handler.
 *           Gibt er `false` zurück, bleibt der Dialog offen (z. B. bei
 *           ungültiger Eingabe). Andere Rückgabewerte ersetzen `value`.
 */

/**
 * Öffnet einen allgemeinen Dialog.
 *
 * @param {object} options
 * @param {string} options.title Überschrift.
 * @param {Node|string} [options.content] Inhalt unter der Überschrift.
 * @param {DialogAction[]} options.actions Schaltflächen (von links nach rechts).
 * @param {HTMLElement} [options.initialFocus] Element, das zuerst den Fokus bekommt.
 * @param {boolean} [options.dismissible=true] Schliessen mit Escape erlaubt?
 * @param {string} [options.className] Zusätzliche CSS-Klasse für Sonderlayouts.
 * @returns {Promise<any>} Wert der gewählten Aktion, `null` bei Abbruch.
 */
export function openDialog({ title, content, actions, initialFocus, dismissible = true, className = '' }) {
  return new Promise((resolve) => {
    let settled = false;

    /**
     * Schliesst den Dialog und liefert das Ergebnis.
     * @param {any} result
     */
    function finish(result) {
      if (settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      resolve(result);
    }

    /**
     * Führt eine Aktion aus (Klick oder Enter).
     * @param {DialogAction} action
     */
    async function runAction(action) {
      if (!action.onClick) return finish(action.value ?? null);
      const result = await action.onClick();
      if (result === false) return; // Dialog bleibt offen
      finish(result === undefined ? action.value ?? null : result);
    }

    const buttons = actions.map((action) =>
      el(
        'button',
        {
          type: 'button',
          class: `btn btn--${action.variant ?? 'secondary'} btn--lg`,
          onclick: () => runAction(action),
        },
        action.label
      )
    );

    const form = el(
      'form',
      { class: 'dialog__form', method: 'dialog' },
      el('h2', { class: 'dialog__title' }, title),
      content ? el('div', { class: 'dialog__content' }, content) : null,
      el('div', { class: 'dialog__actions' }, buttons)
    );

    // Enter im Formular löst die Standard-Aktion aus.
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const defaultAction = actions.find((a) => a.isDefault);
      if (defaultAction) runAction(defaultAction);
    });

    const dialog = el('dialog', { class: `dialog ${className}`.trim() }, form);

    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      if (dismissible) finish(null);
    });

    // Klick auf den abgedunkelten Hintergrund schliesst ebenfalls.
    dialog.addEventListener('click', (event) => {
      if (dismissible && event.target === dialog) finish(null);
    });

    document.body.append(dialog);
    dialog.showModal();
    (initialFocus ?? buttons.at(-1))?.focus();
  });
}

/**
 * Sicherheitsabfrage mit Ja/Nein.
 *
 * @param {object} options
 * @param {string} options.title
 * @param {string} [options.message]
 * @param {string} [options.confirmLabel='OK']
 * @param {boolean} [options.danger=false] Rote Bestätigungs-Schaltfläche.
 * @returns {Promise<boolean>} `true`, wenn bestätigt.
 */
export async function confirmDialog({ title, message, confirmLabel = 'OK', danger = false }) {
  const result = await openDialog({
    title,
    content: message ? el('p', {}, message) : undefined,
    actions: [
      { label: 'Abbrechen', value: false },
      { label: confirmLabel, variant: danger ? 'danger' : 'primary', value: true, isDefault: true },
    ],
  });
  return result === true;
}

/**
 * Dialog mit einem Textfeld.
 *
 * @param {object} options
 * @param {string} options.title
 * @param {string} [options.label] Beschriftung des Feldes.
 * @param {string} [options.value=''] Vorbelegung.
 * @param {number} [options.maxLength]
 * @param {string} [options.confirmLabel='Speichern']
 * @param {DialogAction[]} [options.extraActions] Zusätzliche Schaltflächen links (z. B. "Löschen").
 * @returns {Promise<string|any|null>} Eingegebener Text, Wert einer Zusatzaktion oder `null`.
 */
export function promptDialog({ title, label, value = '', maxLength, confirmLabel = 'Speichern', extraActions = [] }) {
  const input = el('input', {
    class: 'input input--lg',
    type: 'text',
    value,
    maxlength: maxLength,
    autocomplete: 'off',
    'aria-label': label ?? title,
  });

  return openDialog({
    title,
    content: el('label', { class: 'field' }, label ? el('span', { class: 'field__label' }, label) : null, input),
    initialFocus: input,
    actions: [
      ...extraActions,
      { label: 'Abbrechen', value: null },
      {
        label: confirmLabel,
        variant: 'primary',
        isDefault: true,
        onClick: () => {
          const text = input.value.trim();
          if (!text) {
            input.focus();
            return false;
          }
          return text;
        },
      },
    ],
  });
}

/**
 * PIN-Abfrage. Prüft die PIN über die übergebene Funktion, bevor der Dialog
 * schliesst. Kann nicht abgebrochen werden.
 *
 * @param {(pin: string) => Promise<boolean>} verify Prüft die PIN.
 * @returns {Promise<string>} Die korrekte PIN.
 */
export function pinDialog(verify) {
  const input = el('input', {
    class: 'input input--lg input--pin',
    type: 'password',
    inputmode: 'numeric',
    autocomplete: 'off',
    'aria-label': 'PIN',
  });
  const hint = el('p', { class: 'dialog__error', 'aria-live': 'polite' });

  return openDialog({
    title: 'PIN eingeben',
    content: el('div', {}, el('p', {}, 'Die Erfassung ist geschützt.'), input, hint),
    initialFocus: input,
    dismissible: false,
    actions: [
      {
        label: 'Entsperren',
        variant: 'primary',
        isDefault: true,
        onClick: async () => {
          const pin = input.value.trim();
          if (pin && (await verify(pin))) return pin;
          hint.textContent = 'PIN ist falsch.';
          input.select();
          return false;
        },
      },
    ],
  });
}

/**
 * Ziffernblock zum Buchen einer beliebigen Punktzahl (auch negativ).
 * Bedienbar per Touch und per Tastatur.
 *
 * @param {object} options
 * @param {string} options.groupName Name der Gruppe (für die Überschrift).
 * @param {number[]} [options.presets] Vorschlagswerte als Schnellwahl.
 * @param {number} [options.max] Maximaler Betrag pro Buchung.
 * @returns {Promise<number|null>} Gewählte Punkte oder `null` bei Abbruch.
 */
export function pointsDialog({ groupName, presets = [], max = 1000 }) {
  /** Aktuelle Eingabe als Text (ohne Vorzeichen). */
  let digits = '';
  let negative = false;

  const display = el('output', { class: 'keypad__display', 'aria-live': 'polite' });
  const hint = el('p', { class: 'dialog__error', 'aria-live': 'polite' });

  /** @returns {number} Aktueller Wert als Zahl. */
  const currentValue = () => (digits ? Number(digits) * (negative ? -1 : 1) : 0);

  /** Aktualisiert die Anzeige. */
  function render() {
    display.textContent = digits ? formatSigned(currentValue()) : '0';
    display.classList.toggle('is-negative', negative);
    hint.textContent = '';
  }

  /** @param {string} digit Hängt eine Ziffer an. */
  function pressDigit(digit) {
    if (digits.length >= String(max).length) return;
    digits = digits === '0' ? digit : digits + digit;
    render();
  }

  /** Löscht die letzte Ziffer. */
  function backspace() {
    digits = digits.slice(0, -1);
    render();
  }

  /** Wechselt zwischen Plus und Minus. */
  function toggleSign() {
    negative = !negative;
    render();
  }

  /** @param {number} value Setzt einen Vorschlagswert. */
  function setPreset(value) {
    digits = String(Math.abs(value));
    negative = value < 0;
    render();
  }

  const key = (label, onclick, extraClass = '') =>
    el('button', { type: 'button', class: `keypad__key ${extraClass}`.trim(), onclick }, label);

  const keypad = el(
    'div',
    { class: 'keypad' },
    ...['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => key(d, () => pressDigit(d))),
    key('±', toggleSign, 'keypad__key--fn'),
    key('0', () => pressDigit('0')),
    key('⌫', backspace, 'keypad__key--fn')
  );

  const presetRow = presets.length
    ? el(
        'div',
        { class: 'keypad__presets' },
        presets.map((p) => key(formatSigned(p), () => setPreset(p), p < 0 ? 'is-negative' : ''))
      )
    : null;

  /** Tastatur-Bedienung (z. B. mit externer Tastatur oder am PC). */
  function onKeydown(event) {
    if (/^[0-9]$/.test(event.key)) pressDigit(event.key);
    else if (event.key === 'Backspace') backspace();
    else if (event.key === '-' || event.key === '+') toggleSign();
    else return;
    event.preventDefault();
  }
  document.addEventListener('keydown', onKeydown);

  render();

  return openDialog({
    title: `Shots für «${groupName}»`,
    className: 'dialog--keypad',
    content: el('div', {}, display, presetRow, keypad, hint),
    actions: [
      { label: 'Abbrechen', value: null },
      {
        label: 'Speichern',
        variant: 'primary',
        isDefault: true,
        onClick: () => {
          const value = currentValue();
          if (value === 0) {
            hint.textContent = 'Bitte eine Anzahl eingeben.';
            return false;
          }
          if (Math.abs(value) > max) {
            hint.textContent = `Maximal ±${max} Shots pro Buchung.`;
            return false;
          }
          return value;
        },
      },
    ],
  }).finally(() => document.removeEventListener('keydown', onKeydown));
}
