/**
 * @file Fachlogik für Gruppen und Punkte.
 *
 * Der Service ist das "Herz" der Anwendung:
 *  - prüft Eingaben (Validierung),
 *  - ruft das Repository auf (Datenzugriff),
 *  - berechnet die Rangliste,
 *  - meldet Änderungen über den Ereignis-Bus (für Live-Updates).
 *
 * Er kennt weder HTTP noch Express. Dadurch kann er auch aus Tests, einem
 * Kommandozeilen-Skript oder einer späteren anderen Schnittstelle verwendet
 * werden.
 */

'use strict';

const { transaction } = require('../db/database');
const { EVENTS } = require('./eventBus');
const { badRequest, notFound, conflict } = require('../utils/errors');

/**
 * @typedef {import('../repositories/groupRepository').Group} Group
 */

/**
 * @typedef {Group & { rank: number }} RankedGroup
 * Gruppe mit berechnetem Rang. Gleiche Punktzahl ergibt den gleichen Rang
 * (z. B. 1, 2, 2, 4).
 */

/**
 * @typedef {object} RankingSnapshot
 * @property {RankedGroup[]} groups   Alle Gruppen, sortiert nach Rang.
 * @property {boolean}       canUndo  Gibt an, ob eine Buchung rückgängig gemacht werden kann.
 * @property {object|null}   lastChange Info zur letzten Änderung (für Hervorhebungen im Frontend).
 * @property {string}        generatedAt Zeitpunkt der Erstellung (ISO-8601).
 */

/**
 * Sortiert Gruppen für die Rangliste und vergibt Ränge.
 *
 * Sortierung: Punkte absteigend, bei Gleichstand alphabetisch nach Name.
 * Rangvergabe nach "Sport-Prinzip": Gleichstand teilt sich den Rang, der
 * nächste Rang wird übersprungen (1, 2, 2, 4).
 *
 * Reine Funktion ohne Seiteneffekte, deshalb einfach zu testen und anzupassen.
 *
 * @param {Group[]} groups Unsortierte Gruppen.
 * @returns {RankedGroup[]} Neue, sortierte Liste mit Rang.
 */
function rankGroups(groups) {
  const sorted = [...groups].sort(
    (a, b) => b.score - a.score || a.name.localeCompare(b.name, 'de', { sensitivity: 'base' })
  );

  let previousScore = null;
  let previousRank = 0;

  return sorted.map((group, index) => {
    const rank = group.score === previousScore ? previousRank : index + 1;
    previousScore = group.score;
    previousRank = rank;
    return { ...group, rank };
  });
}

/**
 * Erstellt den Gruppen-Service.
 *
 * @param {object} deps Abhängigkeiten (werden "von aussen" übergeben, damit
 *                      sie in Tests einfach ersetzt werden können).
 * @param {import('node:sqlite').DatabaseSync} deps.db Datenbank (für Transaktionen).
 * @param {ReturnType<import('../repositories/groupRepository').createGroupRepository>} deps.repo Repository.
 * @param {import('node:events').EventEmitter} deps.eventBus Ereignis-Bus.
 * @param {{ maxNameLength: number, maxPointsPerBooking: number }} deps.config Grenzwerte.
 */
function createGroupService({ db, repo, eventBus, config }) {
  /** Info zur letzten Änderung, wird an alle Clients mitgeschickt. */
  let lastChange = null;

  /**
   * Prüft und bereinigt einen Gruppennamen.
   * Mehrfache Leerzeichen werden zusammengefasst, Ränder entfernt.
   *
   * @param {unknown} rawName Eingabe aus dem Request.
   * @returns {string} Bereinigter Name.
   * @throws {HttpError} 400, wenn der Name leer oder zu lang ist.
   */
  function validateName(rawName) {
    if (typeof rawName !== 'string') throw badRequest('Bitte einen Namen eingeben.');
    const name = rawName.replace(/\s+/g, ' ').trim();
    if (name.length === 0) throw badRequest('Bitte einen Namen eingeben.');
    if (name.length > config.maxNameLength) {
      throw badRequest(`Der Name darf höchstens ${config.maxNameLength} Zeichen lang sein.`);
    }
    return name;
  }

  /**
   * Prüft eine Punktzahl für eine Buchung.
   *
   * @param {unknown} rawPoints Eingabe aus dem Request (Zahl oder Zahlen-String).
   * @returns {number} Ganzzahl ungleich 0.
   * @throws {HttpError} 400 bei ungültigem Wert.
   */
  function validatePoints(rawPoints) {
    const points = typeof rawPoints === 'string' ? Number(rawPoints.trim()) : rawPoints;
    if (!Number.isInteger(points)) throw badRequest('Punkte müssen eine ganze Zahl sein.');
    if (points === 0) throw badRequest('Bitte eine Punktzahl ungleich 0 eingeben.');
    if (Math.abs(points) > config.maxPointsPerBooking) {
      throw badRequest(`Pro Buchung sind maximal ±${config.maxPointsPerBooking} Punkte erlaubt.`);
    }
    return points;
  }

  /**
   * Prüft eine ID aus der URL.
   *
   * @param {unknown} rawId
   * @returns {number}
   * @throws {HttpError} 400 bei ungültiger ID.
   */
  function validateId(rawId) {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Ungültige Gruppen-ID.');
    return id;
  }

  /**
   * Lädt eine Gruppe oder wirft einen 404-Fehler.
   *
   * @param {number} id
   * @returns {Group}
   * @throws {HttpError} 404, wenn die Gruppe nicht existiert.
   */
  function requireGroup(id) {
    const group = repo.findById(id);
    if (!group) throw notFound('Diese Gruppe existiert nicht (mehr).');
    return group;
  }

  /**
   * Stellt sicher, dass kein anderer Eintrag denselben Namen trägt.
   *
   * @param {string} name
   * @param {number} [exceptId] ID, die ignoriert wird (beim Umbenennen).
   * @throws {HttpError} 409, wenn der Name bereits vergeben ist.
   */
  function ensureUniqueName(name, exceptId) {
    const existing = repo.findByName(name);
    if (existing && existing.id !== exceptId) {
      throw conflict(`Die Gruppe «${existing.name}» gibt es bereits.`);
    }
  }

  /**
   * Merkt sich die letzte Änderung und informiert alle Zuhörer.
   *
   * @param {object} change Beschreibung der Änderung.
   * @param {string} change.action  z. B. "created", "points", "undo".
   * @param {number} [change.groupId]
   * @param {number} [change.points]
   * @returns {void}
   */
  function notify(change) {
    lastChange = { ...change, at: new Date().toISOString() };
    eventBus.emit(EVENTS.RANKING_CHANGED, lastChange);
  }

  return {
    /** Für Tests und Wiederverwendung öffentlich gemacht. */
    rankGroups,

    /**
     * Liefert den kompletten aktuellen Stand für Erfassung und Anzeige.
     * @returns {RankingSnapshot}
     */
    getSnapshot() {
      return {
        groups: rankGroups(repo.findAll()),
        canUndo: repo.findLastEntry() !== null,
        lastChange,
        generatedAt: new Date().toISOString(),
      };
    },

    /**
     * Legt eine neue Gruppe mit 0 Punkten an.
     * @param {unknown} rawName
     * @returns {Group}
     */
    createGroup(rawName) {
      const name = validateName(rawName);
      ensureUniqueName(name);
      const group = repo.insert(name);
      notify({ action: 'created', groupId: group.id });
      return group;
    },

    /**
     * Benennt eine Gruppe um.
     * @param {unknown} rawId
     * @param {unknown} rawName
     * @returns {Group}
     */
    renameGroup(rawId, rawName) {
      const id = validateId(rawId);
      const name = validateName(rawName);
      requireGroup(id);
      ensureUniqueName(name, id);
      repo.rename(id, name);
      notify({ action: 'renamed', groupId: id });
      return repo.findById(id);
    },

    /**
     * Bucht Punkte auf eine Gruppe (negativ = Abzug).
     * Punktestand und Protokoll werden gemeinsam in einer Transaktion
     * geändert, damit sie nie auseinanderlaufen.
     *
     * @param {unknown} rawId
     * @param {unknown} rawPoints
     * @returns {Group} Gruppe mit neuem Punktestand.
     */
    addPoints(rawId, rawPoints) {
      const id = validateId(rawId);
      const points = validatePoints(rawPoints);
      requireGroup(id);
      transaction(db, () => {
        repo.changeScore(id, points);
        repo.insertEntry(id, points);
      });
      notify({ action: 'points', groupId: id, points });
      return repo.findById(id);
    },

    /**
     * Macht die zuletzt erfasste Punktebuchung rückgängig (über alle Gruppen).
     *
     * @returns {{ group: Group, points: number }} Betroffene Gruppe und
     *          die zurückgenommenen Punkte.
     * @throws {HttpError} 404, wenn es nichts rückgängig zu machen gibt.
     */
    undoLastBooking() {
      const entry = repo.findLastEntry();
      if (!entry) throw notFound('Es gibt keine Buchung, die rückgängig gemacht werden kann.');
      transaction(db, () => {
        repo.changeScore(entry.groupId, -entry.points);
        repo.removeEntry(entry.id);
      });
      notify({ action: 'undo', groupId: entry.groupId, points: -entry.points });
      return { group: repo.findById(entry.groupId), points: entry.points };
    },

    /**
     * Löscht eine Gruppe.
     * @param {unknown} rawId
     * @returns {Group} Die gelöschte Gruppe (für Rückmeldungen im Frontend).
     */
    deleteGroup(rawId) {
      const id = validateId(rawId);
      const group = requireGroup(id);
      repo.remove(id);
      notify({ action: 'deleted', groupId: id });
      return group;
    },

    /**
     * Startet eine neue Runde: Alle Punkte auf 0, Gruppen bleiben bestehen.
     * @returns {void}
     */
    resetScores() {
      transaction(db, () => repo.resetAllScores());
      notify({ action: 'reset' });
    },

    /**
     * Löscht alle Gruppen und Punkte (kompletter Neustart).
     * @returns {void}
     */
    deleteAll() {
      transaction(db, () => repo.removeAll());
      notify({ action: 'cleared' });
    },
  };
}

module.exports = { createGroupService, rankGroups };
