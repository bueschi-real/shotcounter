/**
 * @file Lädt Testdaten in die lokale Datenbank.
 *
 * Verwendung:
 *   npm run seed                      Alles löschen, Testdaten aus testdaten.json laden
 *   npm run seed -- --anzahl 30       Zusätzlich so viele Gruppen erzeugen, bis 30 erreicht sind
 *   npm run seed -- --behalten        Bestehende Daten NICHT löschen, nur ergänzen
 *   npm run seed -- --leer            Nur alles löschen (leere Datenbank)
 *
 * (Das "--" nach "npm run seed" ist nötig, damit npm die Optionen weitergibt.)
 *
 * Das Skript schreibt direkt in die Datenbank und verwendet dabei denselben
 * Service wie der Server. Validierung, Ränge und das Buchungsprotokoll
 * verhalten sich also genau wie im echten Betrieb.
 *
 * Läuft der Server gleichzeitig, die Browserseiten danach einmal neu laden
 * (oder eine Buchung machen), damit die neuen Daten angezeigt werden.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const config = require('../src/config');
const { openDatabase } = require('../src/db/database');
const { createGroupRepository } = require('../src/repositories/groupRepository');
const { createEventBus } = require('../src/services/eventBus');
const { createGroupService } = require('../src/services/groupService');

/** Pfad zur Datei mit den Testdaten. */
const TESTDATEN_DATEI = path.join(__dirname, 'testdaten.json');

/** Mögliche Werte für zufällig erzeugte Buchungen. */
const ZUFALLS_PUNKTE = [1, 1, 2, 5, 5, 10];

/**
 * Liest die Kommandozeilen-Optionen.
 *
 * @param {string[]} argv Argumente ohne "node" und Skriptname.
 * @returns {{ anzahl: number, behalten: boolean, leer: boolean, force: boolean }}
 */
function leseOptionen(argv) {
  const anzahlIndex = argv.indexOf('--anzahl');
  const anzahl = anzahlIndex >= 0 ? Number.parseInt(argv[anzahlIndex + 1], 10) : 0;
  return {
    anzahl: Number.isInteger(anzahl) && anzahl > 0 ? anzahl : 0,
    behalten: argv.includes('--behalten'),
    leer: argv.includes('--leer'),
    force: argv.includes('--force'),
  };
}

/**
 * Liefert eine zufällige Ganzzahl zwischen min und max (inklusive).
 *
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function zufall(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Legt eine Gruppe an und bucht ihre Punkte einzeln.
 * Existiert die Gruppe schon (bei --behalten), wird sie übersprungen.
 *
 * @param {ReturnType<typeof createGroupService>} service
 * @param {string} name
 * @param {number[]} buchungen
 * @returns {boolean} `true`, wenn die Gruppe neu angelegt wurde.
 */
function legeGruppeAn(service, name, buchungen) {
  let gruppe;
  try {
    gruppe = service.createGroup(name);
  } catch (err) {
    if (err.status === 409) return false; // Name existiert bereits
    throw err;
  }
  for (const punkte of buchungen) {
    if (punkte !== 0) service.addPoints(gruppe.id, punkte);
  }
  return true;
}

/**
 * Hauptablauf des Skripts.
 * @returns {void}
 */
function main() {
  const optionen = leseOptionen(process.argv.slice(2));

  // Schutz: Nicht versehentlich produktive Daten überschreiben
  if (process.env.NODE_ENV === 'production' && !optionen.force) {
    console.error('Abbruch: NODE_ENV=production. Testdaten nur in der Entwicklung laden (oder --force verwenden).');
    process.exit(1);
  }

  const db = openDatabase({ dataDir: config.dataDir, dbFile: config.dbFile });
  const repo = createGroupRepository(db);
  const service = createGroupService({ db, repo, eventBus: createEventBus(), config });

  if (!optionen.behalten) {
    service.deleteAll();
    console.log('Bestehende Gruppen gelöscht.');
  }

  if (optionen.leer) {
    db.close();
    console.log('Datenbank ist jetzt leer.');
    return;
  }

  // 1. Feste Testdaten aus der JSON-Datei
  const { gruppen } = JSON.parse(fs.readFileSync(TESTDATEN_DATEI, 'utf8'));
  let neu = 0;
  for (const { name, buchungen = [] } of gruppen) {
    if (legeGruppeAn(service, name, buchungen)) neu++;
  }

  // 2. Optional: zusätzliche zufällige Gruppen bis zur gewünschten Anzahl
  let nummer = 1;
  while (optionen.anzahl && repo.findAll().length < optionen.anzahl) {
    const buchungen = Array.from({ length: zufall(0, 6) }, () => ZUFALLS_PUNKTE[zufall(0, ZUFALLS_PUNKTE.length - 1)]);
    if (legeGruppeAn(service, `Testgruppe ${nummer}`, buchungen)) neu++;
    nummer++;
  }

  const total = repo.findAll().length;
  db.close();
  console.log(`${neu} Gruppen angelegt, total ${total} Gruppen in ${path.join(config.dataDir, config.dbFile)}`);
  console.log('Läuft der Server bereits, die Seiten im Browser einmal neu laden.');
}

main();
