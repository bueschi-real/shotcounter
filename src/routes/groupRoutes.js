/**
 * @file REST-Endpunkte für Gruppen und Punkte.
 *
 * Die Routen sind bewusst "dünn": Sie lesen nur die Eingaben aus dem Request,
 * rufen den Service auf und geben das Ergebnis als JSON zurück. Validierung
 * und Logik liegen im Service, Fehler behandelt der zentrale Fehler-Handler.
 *
 * | Methode | Pfad                         | Zweck                          | PIN      |
 * |---------|------------------------------|--------------------------------|----------|
 * | GET     | /api/groups                  | Rangliste (Snapshot) lesen     | nie      |
 * | POST    | /api/groups                  | Gruppe anlegen  {name}         | Schreiben|
 * | PATCH   | /api/groups/:id              | Gruppe umbenennen {name}       | Schreiben|
 * | DELETE  | /api/groups/:id              | Gruppe löschen                 | Schreiben|
 * | POST    | /api/groups/:id/points       | Punkte buchen {points}         | Schreiben|
 * | POST    | /api/groups/undo             | Letzte Buchung rückgängig      | Schreiben|
 * | POST    | /api/groups/reset            | Neue Runde (alle Punkte = 0)   | Schreiben|
 * | DELETE  | /api/groups                  | Alle Gruppen löschen           | Kritisch |
 *
 * ## PIN-Schutzstufen (siehe middleware/requirePin.js)
 * - Schreiben (`requireWritePin`): PIN nur nötig bei PIN_MODE=all.
 * - Kritisch (`requireCriticalPin`): PIN immer nötig (falls eine gesetzt ist).
 *
 * Weitere Aktion als kritisch markieren: `requireCriticalPin` in die Route
 * einsetzen, z. B.
 *   router.delete('/:id', requireCriticalPin, (req, res) => { ... });
 * und im Frontend die Aktion über `runCriticalAction()` auslösen
 * (public/js/pages/erfassung.js).
 */

'use strict';

const express = require('express');

/**
 * Erstellt den Router für Gruppen.
 *
 * @param {object} deps
 * @param {ReturnType<import('../services/groupService').createGroupService>} deps.groupService
 * @param {import('express').RequestHandler} deps.requireWritePin    Schutz für normale Änderungen.
 * @param {import('express').RequestHandler} deps.requireCriticalPin Schutz für kritische Aktionen.
 * @returns {import('express').Router}
 */
function createGroupRoutes({ groupService, requireWritePin, requireCriticalPin }) {
  const router = express.Router();

  /** Aktuelle Rangliste lesen (auch ohne Live-Verbindung nutzbar). */
  router.get('/', (_req, res) => {
    res.json(groupService.getSnapshot());
  });

  // Ab hier: schreibende Routen. PIN nur nötig bei PIN_MODE=all.
  router.use(requireWritePin);

  /** Neue Gruppe anlegen. Body: `{ "name": "Tisch 4" }` */
  router.post('/', (req, res) => {
    const group = groupService.createGroup(req.body?.name);
    res.status(201).json(group);
  });

  /**
   * Letzte Buchung rückgängig machen.
   * Muss VOR `/:id/...` stehen, damit "undo" nicht als ID interpretiert wird.
   */
  router.post('/undo', (_req, res) => {
    res.json(groupService.undoLastBooking());
  });

  /** Neue Runde: alle Punkte auf 0. */
  router.post('/reset', (_req, res) => {
    groupService.resetScores();
    res.status(204).end();
  });

  /** Alle Gruppen löschen. Kritisch: PIN immer nötig. */
  router.delete('/', requireCriticalPin, (_req, res) => {
    groupService.deleteAll();
    res.status(204).end();
  });

  /** Gruppe umbenennen. Body: `{ "name": "Neuer Name" }` */
  router.patch('/:id', (req, res) => {
    res.json(groupService.renameGroup(req.params.id, req.body?.name));
  });

  /** Gruppe löschen. */
  router.delete('/:id', (req, res) => {
    res.json(groupService.deleteGroup(req.params.id));
  });

  /** Punkte buchen. Body: `{ "points": 5 }` (negativ = Abzug) */
  router.post('/:id/points', (req, res) => {
    res.json(groupService.addPoints(req.params.id, req.body?.points));
  });

  return router;
}

module.exports = { createGroupRoutes };
