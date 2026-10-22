/**
 * @file Datenzugriff für Gruppen und Punktebuchungen.
 *
 * Diese Schicht enthält AUSSCHLIESSLICH SQL. Sie kennt keine Validierung,
 * keine HTTP-Details und keine Live-Updates. Soll später eine andere Datenbank
 * verwendet werden (z. B. PostgreSQL), muss nur diese Datei ersetzt werden,
 * solange die Methoden gleich heissen und dasselbe zurückgeben.
 */

'use strict';

/**
 * @typedef {object} Group
 * @property {number} id         Eindeutige ID.
 * @property {string} name       Name der Gruppe.
 * @property {number} score      Aktueller Punktestand.
 * @property {string} createdAt  Erstellzeitpunkt (ISO-8601, UTC).
 * @property {string} updatedAt  Zeitpunkt der letzten Änderung (ISO-8601, UTC).
 */

/**
 * @typedef {object} ScoreEntry
 * @property {number} id         Eindeutige ID der Buchung.
 * @property {number} groupId    ID der betroffenen Gruppe.
 * @property {number} points     Gebuchte Punkte (kann negativ sein).
 * @property {string} createdAt  Zeitpunkt der Buchung (ISO-8601, UTC).
 */

/** SQL-Ausdruck für den aktuellen Zeitpunkt im gleichen Format wie die Spalten-Defaults. */
const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/** Spaltenauswahl für Gruppen, mit Umbenennung in camelCase. */
const GROUP_COLUMNS = 'id, name, score, created_at AS createdAt, updated_at AS updatedAt';

/**
 * Wandelt eine Datenbankzeile in ein sauberes Group-Objekt um.
 * `node:sqlite` liefert Objekte ohne Prototyp, daher wird kopiert.
 *
 * @param {object|undefined} row Zeile aus der Datenbank.
 * @returns {Group|null}
 */
function toGroup(row) {
  return row ? { ...row } : null;
}

/**
 * Erstellt das Repository für Gruppen.
 *
 * Alle SQL-Statements werden einmalig vorbereitet (prepared statements). Das
 * ist schneller und schützt vor SQL-Injection.
 *
 * @param {import('node:sqlite').DatabaseSync} db Offene Datenbankverbindung.
 */
function createGroupRepository(db) {
  const stmt = {
    findAll: db.prepare(`SELECT ${GROUP_COLUMNS} FROM groups`),
    findById: db.prepare(`SELECT ${GROUP_COLUMNS} FROM groups WHERE id = ?`),
    findByName: db.prepare(`SELECT ${GROUP_COLUMNS} FROM groups WHERE name = ? COLLATE NOCASE`),
    insert: db.prepare('INSERT INTO groups (name) VALUES (?)'),
    rename: db.prepare(`UPDATE groups SET name = ?, updated_at = ${NOW} WHERE id = ?`),
    changeScore: db.prepare(`UPDATE groups SET score = score + ?, updated_at = ${NOW} WHERE id = ?`),
    remove: db.prepare('DELETE FROM groups WHERE id = ?'),
    insertEntry: db.prepare('INSERT INTO score_entries (group_id, points) VALUES (?, ?)'),
    findLastEntry: db.prepare(
      'SELECT id, group_id AS groupId, points, created_at AS createdAt FROM score_entries ORDER BY id DESC LIMIT 1'
    ),
    removeEntry: db.prepare('DELETE FROM score_entries WHERE id = ?'),
    resetScores: db.prepare(`UPDATE groups SET score = 0, updated_at = ${NOW}`),
    removeAllEntries: db.prepare('DELETE FROM score_entries'),
    removeAllGroups: db.prepare('DELETE FROM groups'),
  };

  return {
    /**
     * Liefert alle Gruppen (unsortiert, Sortierung übernimmt der Service).
     * @returns {Group[]}
     */
    findAll() {
      return stmt.findAll.all().map(toGroup);
    },

    /**
     * Sucht eine Gruppe anhand ihrer ID.
     * @param {number} id
     * @returns {Group|null}
     */
    findById(id) {
      return toGroup(stmt.findById.get(id));
    },

    /**
     * Sucht eine Gruppe anhand ihres Namens (ohne Beachtung der Gross-/Kleinschreibung).
     * @param {string} name
     * @returns {Group|null}
     */
    findByName(name) {
      return toGroup(stmt.findByName.get(name));
    },

    /**
     * Legt eine neue Gruppe mit 0 Punkten an.
     * @param {string} name Bereits validierter Name.
     * @returns {Group} Die neu erstellte Gruppe.
     */
    insert(name) {
      const { lastInsertRowid } = stmt.insert.run(name);
      return this.findById(Number(lastInsertRowid));
    },

    /**
     * Ändert den Namen einer Gruppe.
     * @param {number} id
     * @param {string} name Bereits validierter neuer Name.
     * @returns {boolean} `true`, wenn eine Zeile geändert wurde.
     */
    rename(id, name) {
      return stmt.rename.run(name, id).changes > 0;
    },

    /**
     * Ändert den Punktestand einer Gruppe um `points` (ohne Protokolleintrag).
     * @param {number} id
     * @param {number} points Positiv oder negativ.
     * @returns {boolean} `true`, wenn eine Zeile geändert wurde.
     */
    changeScore(id, points) {
      return stmt.changeScore.run(points, id).changes > 0;
    },

    /**
     * Löscht eine Gruppe inkl. aller ihrer Buchungen.
     * @param {number} id
     * @returns {boolean} `true`, wenn eine Gruppe gelöscht wurde.
     */
    remove(id) {
      return stmt.remove.run(id).changes > 0;
    },

    /**
     * Protokolliert eine Punktebuchung.
     * @param {number} groupId
     * @param {number} points
     * @returns {number} ID der neuen Buchung.
     */
    insertEntry(groupId, points) {
      return Number(stmt.insertEntry.run(groupId, points).lastInsertRowid);
    },

    /**
     * Liefert die zuletzt erfasste Buchung (über alle Gruppen).
     * @returns {ScoreEntry|null}
     */
    findLastEntry() {
      const row = stmt.findLastEntry.get();
      return row ? { ...row } : null;
    },

    /**
     * Löscht eine einzelne Buchung aus dem Protokoll.
     * @param {number} entryId
     * @returns {boolean}
     */
    removeEntry(entryId) {
      return stmt.removeEntry.run(entryId).changes > 0;
    },

    /**
     * Setzt die Punkte aller Gruppen auf 0 und leert das Protokoll.
     * Die Gruppen selbst bleiben bestehen.
     * @returns {void}
     */
    resetAllScores() {
      stmt.resetScores.run();
      stmt.removeAllEntries.run();
    },

    /**
     * Löscht alle Gruppen und alle Buchungen.
     * @returns {void}
     */
    removeAll() {
      stmt.removeAllEntries.run();
      stmt.removeAllGroups.run();
    },
  };
}

module.exports = { createGroupRepository };
