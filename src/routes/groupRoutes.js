/**
 * @file REST-Endpunkte für Gruppen und Punkte.
 *
 * Die Routen sind bewusst "dünn": Sie lesen nur die Eingaben aus dem Request,
 * rufen den Service auf und geben das Ergebnis als JSON zurück. Validierung
 * und Logik liegen im Service, Fehler behandelt der zentrale Fehler-Handler.
 *
 * | Methode | Pfad                         | Zweck                          | PIN |
 * |---------|------------------------------|--------------------------------|-----|
 * | GET     | /api/groups                  | Rangliste (Snapshot) lesen     | nein|
 * | POST    | /api/groups                  | Gruppe anlegen  {name}         | ja  |
 * | PATCH   | /api/groups/:id              | Gruppe umbenennen {name}       | ja  |
 * | DELETE  | /api/groups/:id              | Gruppe löschen                 | ja  |
 * | POST    | /api/groups/:id/points       | Punkte buchen {points}         | ja  |
 * | POST    | /api/groups/undo             | Letzte Buchung rückgängig      | ja  |
 * | POST    | /api/groups/reset            | Neue Runde (alle Punkte = 0)   | ja  |
 * | DELETE  | /api/groups                  | Alle Gruppen löschen           | ja  |
 */

'use strict';

const express = require('express');

/**
 * Erstellt den Router für Gruppen.
 *
 * @param {object} deps
 * @param {ReturnType<import('../services/groupService').createGroupService>} deps.groupService
 * @param {import('express').RequestHandler} deps.requirePin Middleware für den PIN-Schutz.
 * @returns {import('express').Router}
 */
function createGroupRoutes({ groupService, requirePin }) {
  const router = express.Router();

  /** Aktuelle Rangliste lesen (auch ohne Live-Verbindung nutzbar). */
  router.get('/', (_req, res) => {
    res.json(groupService.getSnapshot());
  });

  // Ab hier: alle Routen nur mit gültiger PIN.
  router.use(requirePin);

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

  /** Alle Gruppen löschen. */
  router.delete('/', (_req, res) => {
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
