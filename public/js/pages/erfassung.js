/**
 * @file Seiten-Controller für die Erfassung (Tablet).
 *
 * Verbindet die Bausteine:
 *  - Live-Verbindung → hält die Kartenansicht aktuell (auch bei mehreren Tablets),
 *  - Formular "Neue Gruppe",
 *  - Gruppenkarten mit Schnellbuttons und Ziffernblock,
 *  - Suche, Sortierung, Rückgängig, Menü (neue Runde, alles löschen).
 *
 * Datenfluss: Aktionen gehen per REST an den Server. Die Anzeige wird NICHT
 * direkt geändert, sondern über den Live-Snapshot aktualisiert, der nach jeder
 * Änderung vom Server kommt. So sehen alle Geräte immer denselben Stand.
 */

import { api } from '../core/api.js';
import { connectLive } from '../core/liveConnection.js';
import { $, restartAnimation } from '../core/dom.js';
import { formatSigned, pointsLabel } from '../core/format.js';
import { readValue, writeValue, removeValue } from '../core/storage.js';
import { ERFASSUNG, STORAGE_KEYS } from '../settings.js';
import { showToast } from '../components/toast.js';
import { openDialog, confirmDialog, promptDialog, pinDialog, pointsDialog } from '../components/dialog.js';
import { createGroupCard } from '../components/groupCard.js';
import { createConnectionBadge } from '../components/connectionBadge.js';

// ---------------------------------------------------------------------------
// Zustand der Seite
// ---------------------------------------------------------------------------

/** Zentraler Zustand. Wird nur über die Funktionen unten verändert. */
const state = {
  /** Server-Konfiguration (Titel, PIN nötig?, Grenzwerte). */
  config: null,
  /** Letzter Snapshot vom Server. */
  snapshot: { groups: [], canUndo: false },
  /** Sortierung der Karten: 'name' | 'score' | 'newest'. */
  sort: readValue(STORAGE_KEYS.sort, ERFASSUNG.defaultSort),
  /** Suchtext (klein geschrieben). */
  filter: '',
  /** ID einer neu erstellten Gruppe, die nach dem nächsten Zeichnen angezeigt werden soll. */
  focusGroupId: null,
};

/** Bereits erstellte Karten, nach Gruppen-ID. @type {Map<number, ReturnType<typeof createGroupCard>>} */
const cards = new Map();

/** Wichtige Elemente der Seite. */
const dom = {
  title: $('#app-title'),
  connSlot: $('#conn'),
  createForm: $('#create-form'),
  createInput: $('#create-name'),
  search: $('#search'),
  sortButtons: [...document.querySelectorAll('[data-sort]')],
  undoButton: $('#undo-btn'),
  menuButton: $('#menu-btn'),
  cards: $('#cards'),
  empty: $('#empty'),
  count: $('#count'),
};

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/**
 * Sucht eine Gruppe im aktuellen Snapshot.
 * @param {number} id
 * @returns {object|undefined}
 */
function findGroup(id) {
  return state.snapshot.groups.find((g) => g.id === id);
}

/**
 * Prüft eine PIN beim Server.
 * @param {string} pin
 * @returns {Promise<boolean>} `true`, wenn die PIN stimmt.
 */
async function verifyPin(pin) {
  try {
    await api.checkPin(pin);
    return true;
  } catch (err) {
    if (err.isUnauthorized) return false;
    showToast(err.message, { type: 'error' });
    return false;
  }
}

/**
 * Stellt sicher, dass eine gültige PIN gespeichert ist (falls nötig).
 * Fragt sie andernfalls per Dialog ab.
 * @returns {Promise<void>}
 */
async function ensurePin() {
  if (!state.config?.pinRequired) return;
  const stored = readValue(STORAGE_KEYS.pin);
  if (stored && (await verifyPin(stored))) return;
  removeValue(STORAGE_KEYS.pin);
  const pin = await pinDialog(verifyPin);
  writeValue(STORAGE_KEYS.pin, pin);
}

/**
 * Führt eine Server-Aktion aus und behandelt Fehler einheitlich:
 *  - PIN ungültig → PIN neu abfragen und Aktion einmal wiederholen,
 *  - andere Fehler → als rote Meldung anzeigen.
 *
 * @template T
 * @param {() => Promise<T>} action
 * @returns {Promise<T|undefined>} Ergebnis oder `undefined` bei Fehler.
 */
async function runAction(action) {
  try {
    return await action();
  } catch (err) {
    if (err.isUnauthorized) {
      removeValue(STORAGE_KEYS.pin);
      await ensurePin();
      return runAction(action);
    }
    showToast(err.message, { type: 'error', durationMs: 5000 });
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Aktionen
// ---------------------------------------------------------------------------

/**
 * Legt eine neue Gruppe an (aus dem Formular oben).
 * @param {SubmitEvent} event
 */
async function handleCreate(event) {
  event.preventDefault();
  const name = dom.createInput.value.trim();
  if (!name) {
    dom.createInput.focus();
    return;
  }
  const group = await runAction(() => api.createGroup(name));
  if (!group) return;

  dom.createInput.value = '';
  dom.search.value = '';
  state.filter = '';
  state.focusGroupId = group.id;
  showToast(`Gruppe «${group.name}» erstellt`, { type: 'success', durationMs: ERFASSUNG.toastDurationMs });
  render(); // falls der Live-Snapshot schon da ist
}

/**
 * Bucht Punkte und zeigt eine Meldung mit "Rückgängig" an.
 * @param {number} groupId
 * @param {number} points
 */
async function bookPoints(groupId, points) {
  const group = await runAction(() => api.addPoints(groupId, points));
  if (!group) return;
  showToast(`${formatSigned(points)} ${pointsLabel(points)} für «${group.name}»`, {
    type: 'success',
    durationMs: ERFASSUNG.toastDurationMs,
    action: { label: 'Rückgängig', onClick: undoLast },
  });
}

/**
 * Öffnet den Ziffernblock für eine beliebige Punktzahl.
 * @param {number} groupId
 */
async function openCustomPoints(groupId) {
  const group = findGroup(groupId);
  if (!group) return;
  const points = await pointsDialog({
    groupName: group.name,
    presets: ERFASSUNG.dialogPresets,
    max: state.config.maxPointsPerBooking,
  });
  if (points !== null) await bookPoints(groupId, points);
}

/**
 * Bearbeiten-Dialog: Umbenennen oder Löschen einer Gruppe.
 * @param {number} groupId
 */
async function editGroup(groupId) {
  const group = findGroup(groupId);
  if (!group) return;

  const DELETE = Symbol('delete');
  const result = await promptDialog({
    title: 'Gruppe bearbeiten',
    label: 'Name',
    value: group.name,
    maxLength: state.config.maxNameLength,
    extraActions: [{ label: 'Löschen', variant: 'danger', value: DELETE }],
  });

  if (result === DELETE) {
    const ok = await confirmDialog({
      title: `«${group.name}» löschen?`,
      message: `Die Gruppe und ihre ${group.score} Punkte werden endgültig entfernt.`,
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (ok && (await runAction(() => api.deleteGroup(groupId)))) {
      showToast(`«${group.name}» gelöscht`, { durationMs: ERFASSUNG.toastDurationMs });
    }
    return;
  }

  if (typeof result === 'string' && result !== group.name) {
    const renamed = await runAction(() => api.renameGroup(groupId, result));
    if (renamed) showToast(`Umbenannt in «${renamed.name}»`, { type: 'success' });
  }
}

/** Macht die letzte Buchung rückgängig (egal von welchem Gerät). */
async function undoLast() {
  const result = await runAction(() => api.undo());
  if (!result) return;
  showToast(`Rückgängig: ${formatSigned(-result.points)} bei «${result.group.name}»`, {
    durationMs: ERFASSUNG.toastDurationMs,
  });
}

/** Öffnet das Menü mit selteneren Aktionen. */
async function openMenu() {
  const choice = await openDialog({
    title: 'Menü',
    className: 'dialog--menu',
    actions: [
      { label: 'Rangliste in neuem Fenster öffnen', value: 'open' },
      { label: 'Neue Runde (alle Punkte auf 0)', value: 'reset' },
      { label: 'Alle Gruppen löschen', variant: 'danger', value: 'clear' },
      { label: 'Schliessen', value: null },
    ],
  });

  if (choice === 'open') {
    window.open('/rangliste', '_blank');
  } else if (choice === 'reset') {
    const ok = await confirmDialog({
      title: 'Neue Runde starten?',
      message: 'Alle Gruppen bleiben bestehen, die Punkte werden auf 0 gesetzt.',
      confirmLabel: 'Neue Runde',
      danger: true,
    });
    if (ok && (await runAction(() => api.resetScores())) !== undefined) {
      showToast('Neue Runde gestartet', { type: 'success' });
    }
  } else if (choice === 'clear') {
    const ok = await confirmDialog({
      title: 'Alle Gruppen löschen?',
      message: 'Alle Gruppen und Punkte werden endgültig gelöscht.',
      confirmLabel: 'Alles löschen',
      danger: true,
    });
    if (ok && (await runAction(() => api.deleteAll())) !== undefined) {
      showToast('Alle Gruppen gelöscht');
    }
  }
}

/**
 * Wechselt die Sortierung und merkt sie sich für den nächsten Besuch.
 * @param {'name'|'score'|'newest'} sort
 */
function setSort(sort) {
  state.sort = sort;
  writeValue(STORAGE_KEYS.sort, sort);
  render();
}

// ---------------------------------------------------------------------------
// Darstellung
// ---------------------------------------------------------------------------

/** Sortierfunktionen pro Modus. Neue Sortierungen einfach hier ergänzen. */
const SORTERS = {
  name: (a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }),
  score: (a, b) => a.rank - b.rank || a.name.localeCompare(b.name, 'de'),
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id,
};

/**
 * Liefert die anzuzeigenden Gruppen (gefiltert und sortiert).
 * @returns {object[]}
 */
function visibleGroups() {
  const sorter = SORTERS[state.sort] ?? SORTERS.name;
  return state.snapshot.groups
    .filter((g) => !state.filter || g.name.toLowerCase().includes(state.filter))
    .sort(sorter);
}

/**
 * Zeichnet die Kartenansicht anhand des aktuellen Zustands.
 * Bestehende Karten werden wiederverwendet und nur bei Bedarf verschoben,
 * damit Fokus und Animationen erhalten bleiben.
 */
function render() {
  const groups = visibleGroups();
  const allIds = new Set(state.snapshot.groups.map((g) => g.id));

  // Karten entfernen, deren Gruppe gelöscht wurde
  for (const [id, card] of cards) {
    if (!allIds.has(id)) {
      card.element.remove();
      cards.delete(id);
    }
  }

  // Karten erstellen/aktualisieren und in die richtige Reihenfolge bringen
  const visibleIds = new Set();
  groups.forEach((group, index) => {
    visibleIds.add(group.id);
    let card = cards.get(group.id);
    if (card) {
      card.update(group);
    } else {
      card = createGroupCard(group, {
        quickPoints: ERFASSUNG.quickPoints,
        handlers: { onQuickPoints: bookPoints, onCustomPoints: openCustomPoints, onEdit: editGroup },
      });
      cards.set(group.id, card);
    }
    if (dom.cards.children[index] !== card.element) {
      dom.cards.insertBefore(card.element, dom.cards.children[index] ?? null);
    }
  });

  // Durch Suche ausgeblendete Karten aus der Ansicht nehmen
  for (const [id, card] of cards) {
    if (!visibleIds.has(id)) card.element.remove();
  }

  // Leerer Zustand / Zähler / Rückgängig-Schaltfläche
  const total = state.snapshot.groups.length;
  dom.empty.hidden = groups.length > 0;
  dom.empty.textContent = total === 0 ? 'Noch keine Gruppen. Lege oben die erste an.' : 'Keine Gruppe passt zur Suche.';
  dom.count.textContent = `${total} ${total === 1 ? 'Gruppe' : 'Gruppen'}`;
  dom.undoButton.disabled = !state.snapshot.canUndo;
  for (const button of dom.sortButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.sort === state.sort));
  }

  // Neu erstellte Gruppe anzeigen und kurz hervorheben
  if (state.focusGroupId && cards.has(state.focusGroupId)) {
    const element = cards.get(state.focusGroupId).element;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    restartAnimation(element, 'is-new');
    state.focusGroupId = null;
  }
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

/**
 * Initialisiert die Seite: Konfiguration laden, PIN prüfen, Live-Verbindung
 * aufbauen und Bedienelemente verknüpfen.
 * @returns {Promise<void>}
 */
async function init() {
  state.config = await api.getConfig().catch(() => ({
    appTitle: 'Rangliste',
    pinRequired: false,
    maxNameLength: 40,
    maxPointsPerBooking: 1000,
  }));
  dom.title.textContent = state.config.appTitle;
  document.title = `Erfassung · ${state.config.appTitle}`;
  dom.createInput.maxLength = state.config.maxNameLength;

  await ensurePin();

  const badge = createConnectionBadge();
  dom.connSlot.replaceWith(badge.element);

  connectLive({
    onSnapshot: (snapshot) => {
      state.snapshot = snapshot;
      render();
    },
    onStatus: badge.setStatus,
  });

  dom.createForm.addEventListener('submit', handleCreate);
  dom.search.addEventListener('input', () => {
    state.filter = dom.search.value.trim().toLowerCase();
    render();
  });
  for (const button of dom.sortButtons) button.addEventListener('click', () => setSort(button.dataset.sort));
  dom.undoButton.addEventListener('click', undoLast);
  dom.menuButton.addEventListener('click', openMenu);

  render();
}

init();
