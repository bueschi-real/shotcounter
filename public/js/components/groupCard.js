/**
 * @file Karte einer Gruppe auf der Erfassungsseite.
 *
 * Zeigt Name, Rang und Punkte sowie Schaltflächen zum Buchen. Die Karte
 * enthält keine eigene Logik für Serveraufrufe: Sie meldet Klicks über die
 * übergebenen Handler an die Seite. So kann sie auch an anderer Stelle
 * wiederverwendet werden.
 */

import { el, playAnimationOnce } from '../core/dom.js';
import { formatPoints, formatSigned } from '../core/format.js';

/**
 * @typedef {object} GroupCardHandlers
 * @property {(groupId: number, points: number) => void} onQuickPoints Schnellbutton gedrückt.
 * @property {(groupId: number) => void} onCustomPoints  Ziffernblock öffnen.
 * @property {(groupId: number) => void} onEdit          Bearbeiten (Umbenennen/Löschen).
 */

/**
 * Erstellt eine Gruppenkarte.
 *
 * @param {object} group Gruppe aus dem Snapshot (id, name, score, rank).
 * @param {object} options
 * @param {number[]} options.quickPoints Werte der Schnellbuttons.
 * @param {GroupCardHandlers} options.handlers
 * @returns {{ element: HTMLElement, update: (group: object) => void }}
 */
export function createGroupCard(group, { quickPoints, handlers }) {
  const nameEl = el('h3', { class: 'card__name' });
  const rankEl = el('span', { class: 'card__rank' });
  const scoreEl = el('span', { class: 'card__score' });

  const quickButtons = quickPoints.map((points) =>
    el(
      'button',
      {
        type: 'button',
        class: `btn btn--points ${points < 0 ? 'btn--minus' : ''}`.trim(),
        onclick: () => handlers.onQuickPoints(current.id, points),
      },
      formatSigned(points)
    )
  );

  const element = el(
    'article',
    { class: 'card', dataset: { id: group.id } },
    el(
      'header',
      { class: 'card__header' },
      nameEl,
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn--icon',
          'aria-label': 'Gruppe bearbeiten',
          title: 'Bearbeiten',
          onclick: () => handlers.onEdit(current.id),
        },
        '✎'
      )
    ),
    el('div', { class: 'card__stats' }, scoreEl, rankEl),
    el(
      'div',
      { class: 'card__buttons' },
      quickButtons,
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn--points btn--custom',
          'aria-label': 'Andere Punktzahl',
          onclick: () => handlers.onCustomPoints(current.id),
        },
        '±…'
      )
    )
  );

  /** Zuletzt angezeigter Stand (für Vergleich bei Updates). */
  let current = null;

  /**
   * Aktualisiert die Anzeige mit neuen Daten.
   * Ändert sich der Punktestand, blinkt die Zahl kurz auf.
   *
   * @param {object} next Neue Gruppendaten.
   * @returns {void}
   */
  function update(next) {
    nameEl.textContent = next.name;
    scoreEl.textContent = formatPoints(next.score);
    rankEl.textContent = `Rang ${next.rank}`;
    if (current && current.score !== next.score) playAnimationOnce(scoreEl, 'is-bumped');
    current = { ...next };
  }

  update(group);
  return { element, update };
}
