/**
 * @file Datenbankverbindung und Schema-Migrationen.
 *
 * Verwendet das in Node.js eingebaute Modul `node:sqlite` (ab Node 22.13 ohne
 * Zusatzflag). Dadurch sind keine nativen Zusatzmodule nötig, und das Docker-
 * Image lässt sich ohne Compiler für Intel/AMD und ARM bauen.
 *
 * ## Schema erweitern
 * Neue Tabellen oder Spalten werden NICHT in bestehenden Migrationen geändert,
 * sondern als neuer Eintrag am Ende von `MIGRATIONS` angehängt. Beim Start
 * werden nur Migrationen ausgeführt, die noch nicht gelaufen sind. Die Version
 * wird in `PRAGMA user_version` gespeichert. So bleiben bestehende Daten auf
 * dem NAS bei Updates erhalten.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

/**
 * Liste aller Schema-Migrationen in fester Reihenfolge.
 * Index 0 = Version 1, Index 1 = Version 2 usw.
 *
 * @type {string[]}
 */
const MIGRATIONS = [
  // Version 1: Gruppen und Punktebuchungen
  `
  CREATE TABLE groups (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    score       INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  -- Gruppennamen sind eindeutig, ohne Beachtung von Gross-/Kleinschreibung.
  CREATE UNIQUE INDEX idx_groups_name ON groups (name COLLATE NOCASE);

  -- Jede Punkteänderung wird protokolliert. Das ermöglicht "Rückgängig"
  -- und später z. B. eine Verlaufsanzeige oder Statistiken.
  CREATE TABLE score_entries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id    INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    points      INTEGER NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE INDEX idx_score_entries_group ON score_entries (group_id);
  `,
];

/**
 * Führt alle noch ausstehenden Migrationen aus.
 *
 * Jede Migration läuft in einer eigenen Transaktion. Schlägt eine fehl, wird
 * sie vollständig zurückgerollt und der Start abgebrochen.
 *
 * @param {DatabaseSync} db Offene Datenbankverbindung.
 * @returns {void}
 */
function runMigrations(db) {
  const currentVersion = db.prepare('PRAGMA user_version').get().user_version;

  for (let version = currentVersion; version < MIGRATIONS.length; version++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[version]);
      // PRAGMA unterstützt keine Parameter, die Zahl ist aber intern erzeugt.
      db.exec(`PRAGMA user_version = ${version + 1}`);
      db.exec('COMMIT');
      console.log(`[db] Migration auf Version ${version + 1} ausgeführt.`);
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

/**
 * Öffnet (bzw. erstellt) die SQLite-Datenbank und bringt das Schema auf den
 * neuesten Stand.
 *
 * @param {object} options
 * @param {string} options.dataDir  Ordner, in dem die Datenbankdatei liegt.
 * @param {string} options.dbFile   Dateiname der Datenbank. Mit ":memory:"
 *                                  entsteht eine flüchtige Datenbank (für Tests).
 * @returns {DatabaseSync} Einsatzbereite Datenbankverbindung.
 */
function openDatabase({ dataDir, dbFile }) {
  let location = dbFile;

  if (dbFile !== ':memory:') {
    fs.mkdirSync(dataDir, { recursive: true });
    location = path.join(dataDir, dbFile);
  }

  const db = new DatabaseSync(location);

  // WAL: robuster bei gleichzeitigem Lesen/Schreiben und bei Stromausfall.
  if (dbFile !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  // Fremdschlüssel aktivieren, damit ON DELETE CASCADE greift.
  db.exec('PRAGMA foreign_keys = ON');

  runMigrations(db);
  console.log(`[db] Datenbank geöffnet: ${location}`);
  return db;
}

/**
 * Führt eine Funktion innerhalb einer Transaktion aus.
 * Wirft die Funktion einen Fehler, werden alle Änderungen verworfen.
 *
 * @template T
 * @param {DatabaseSync} db  Datenbankverbindung.
 * @param {() => T} fn       Auszuführende Funktion.
 * @returns {T} Rückgabewert von `fn`.
 */
function transaction(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = { openDatabase, transaction };
