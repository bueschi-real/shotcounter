/**
 * @file Automatische Tests für Backend und API.
 *
 * Ausführen mit:  npm test
 *
 * Verwendet den eingebauten Test-Runner von Node.js (keine Zusatzpakete) und
 * eine Datenbank im Arbeitsspeicher, die echten Daten bleiben also unberührt.
 */

'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const baseConfig = require('../src/config');
const { createApp } = require('../src/app');
const { rankGroups } = require('../src/services/groupService');

/** Testkonfiguration: Datenbank im Speicher, PIN "9999". */
const config = { ...baseConfig, dbFile: ':memory:', adminPin: '9999', heartbeatMs: 60000 };

describe('rankGroups', () => {
  test('sortiert nach Punkten und vergibt bei Gleichstand denselben Rang', () => {
    const ranked = rankGroups([
      { id: 1, name: 'B', score: 5 },
      { id: 2, name: 'A', score: 10 },
      { id: 3, name: 'C', score: 5 },
      { id: 4, name: 'D', score: 1 },
    ]);
    assert.deepEqual(
      ranked.map((g) => [g.name, g.rank]),
      [
        ['A', 1],
        ['B', 2],
        ['C', 2],
        ['D', 4],
      ]
    );
  });
});

describe('REST-API', () => {
  let server;
  let baseUrl;
  let shutdown;

  /**
   * Hilfsfunktion für API-Aufrufe im Test.
   * @param {string} method
   * @param {string} path
   * @param {object} [body]
   * @param {string|null} [pin='9999']
   */
  async function call(method, path, body, pin = '9999') {
    const headers = { 'Content-Type': 'application/json' };
    if (pin) headers['X-Admin-Pin'] = pin;
    const res = await fetch(baseUrl + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = res.status === 204 ? null : await res.json();
    return { status: res.status, data };
  }

  before(async () => {
    const created = createApp(config);
    shutdown = created.shutdown;
    await new Promise((resolve) => {
      server = created.app.listen(0, resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => {
    shutdown();
    server.close();
  });

  test('schreibende Aktionen ohne PIN werden abgelehnt', async () => {
    const res = await call('POST', '/api/groups', { name: 'Tisch 1' }, null);
    assert.equal(res.status, 401);
  });

  test('lesen geht ohne PIN', async () => {
    const res = await call('GET', '/api/groups', undefined, null);
    assert.equal(res.status, 200);
    assert.deepEqual(res.data.groups, []);
  });

  test('Gruppe anlegen startet mit 0 Punkten', async () => {
    const res = await call('POST', '/api/groups', { name: '  Tisch   1 ' });
    assert.equal(res.status, 201);
    assert.equal(res.data.name, 'Tisch 1');
    assert.equal(res.data.score, 0);
  });

  test('doppelte Namen werden abgelehnt (ohne Gross/Klein)', async () => {
    const res = await call('POST', '/api/groups', { name: 'tisch 1' });
    assert.equal(res.status, 409);
  });

  test('leere Namen werden abgelehnt', async () => {
    const res = await call('POST', '/api/groups', { name: '   ' });
    assert.equal(res.status, 400);
  });

  test('Punkte buchen, Rangliste und Rückgängig', async () => {
    const b = (await call('POST', '/api/groups', { name: 'Tisch 2' })).data;
    await call('POST', `/api/groups/${b.id}/points`, { points: 10 });
    await call('POST', `/api/groups/${b.id}/points`, { points: 5 });

    let snap = (await call('GET', '/api/groups')).data;
    assert.equal(snap.groups[0].name, 'Tisch 2');
    assert.equal(snap.groups[0].score, 15);
    assert.equal(snap.groups[0].rank, 1);
    assert.equal(snap.canUndo, true);

    const undo = await call('POST', '/api/groups/undo');
    assert.equal(undo.status, 200);
    assert.equal(undo.data.points, 5);

    snap = (await call('GET', '/api/groups')).data;
    assert.equal(snap.groups[0].score, 10);
  });

  test('ungültige Punkte werden abgelehnt', async () => {
    const id = (await call('GET', '/api/groups')).data.groups[0].id;
    assert.equal((await call('POST', `/api/groups/${id}/points`, { points: 0 })).status, 400);
    assert.equal((await call('POST', `/api/groups/${id}/points`, { points: 1.5 })).status, 400);
    assert.equal((await call('POST', `/api/groups/${id}/points`, { points: 999999 })).status, 400);
    assert.equal((await call('POST', `/api/groups/99999/points`, { points: 1 })).status, 404);
  });

  test('umbenennen und löschen', async () => {
    const g = (await call('POST', '/api/groups', { name: 'Temp' })).data;
    const renamed = await call('PATCH', `/api/groups/${g.id}`, { name: 'Tisch 3' });
    assert.equal(renamed.data.name, 'Tisch 3');
    assert.equal((await call('DELETE', `/api/groups/${g.id}`)).status, 200);
    assert.equal((await call('DELETE', `/api/groups/${g.id}`)).status, 404);
  });

  test('neue Runde setzt alle Punkte auf 0', async () => {
    assert.equal((await call('POST', '/api/groups/reset')).status, 204);
    const snap = (await call('GET', '/api/groups')).data;
    assert.ok(snap.groups.length > 0);
    assert.ok(snap.groups.every((g) => g.score === 0));
    assert.equal(snap.canUndo, false);
  });

  test('Live-Verbindung liefert sofort einen Snapshot', async () => {
    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/api/events`, { signal: controller.signal });
    assert.match(res.headers.get('content-type'), /text\/event-stream/);
    const reader = res.body.getReader();
    let text = '';
    while (!text.includes('event: snapshot')) {
      const { value } = await reader.read();
      text += new TextDecoder().decode(value);
    }
    controller.abort();
    assert.ok(text.includes('"groups"'));
  });

  test('Frontend-Seiten werden ausgeliefert', async () => {
    assert.equal((await fetch(`${baseUrl}/`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/rangliste`)).status, 200);
  });
});
