/**
 * @file Simuliert laufenden Betrieb: Bucht in regelmässigen Abständen
 * zufällige Punkte auf zufällige Gruppen, über die normale REST-API.
 *
 * Damit lässt sich die Ranglisten-Anzeige (Animationen, Rangwechsel,
 * Hervorhebung) testen, ohne selbst auf dem Tablet zu tippen.
 *
 * Voraussetzung: Der Server läuft (npm run dev) und es gibt Gruppen
 * (z. B. über npm run seed).
 *
 * Verwendung:
 *   npm run simulate                          Alle 2 Sekunden eine Buchung
 *   npm run simulate -- --intervall 500       Alle 0,5 Sekunden
 *   npm run simulate -- --neu 10              Zusätzlich ca. 10 % Chance auf neue Gruppe
 *
 * Umgebungsvariablen:
 *   BASE_URL   Adresse des Servers (Standard: http://localhost:3000)
 *   ADMIN_PIN  PIN, falls der Server eine verlangt
 *
 * Beenden mit Ctrl+C.
 */

'use strict';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const PIN = process.env.ADMIN_PIN || 'admin';

/** Mögliche Werte pro Buchung (häufigere Werte mehrfach aufgeführt). */
const PUNKTE = [1, 3, 4, 5, 5, 10, 15];

/**
 * Liest eine Zahl-Option aus den Kommandozeilen-Argumenten.
 *
 * @param {string} name     Name der Option, z. B. "--intervall".
 * @param {number} fallback Standardwert.
 * @returns {number}
 */
function leseZahl(name, fallback) {
  const index = process.argv.indexOf(name);
  const wert = index >= 0 ? Number(process.argv[index + 1]) : NaN;
  return Number.isFinite(wert) && wert >= 0 ? wert : fallback;
}

/**
 * Ruft die API auf.
 *
 * @param {string} method
 * @param {string} pfad
 * @param {object} [body]
 * @returns {Promise<any>} Antwortdaten.
 * @throws {Error} Bei Netzwerk- oder API-Fehlern.
 */
async function api(method, pfad, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (PIN) headers['X-Admin-Pin'] = PIN;
  const res = await fetch(BASE_URL + pfad, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return data;
}

/**
 * Wählt ein zufälliges Element aus einer Liste.
 *
 * @template T
 * @param {T[]} liste
 * @returns {T}
 */
function zufaellig(liste) {
  return liste[Math.floor(Math.random() * liste.length)];
}

/** Zähler für neu erzeugte Gruppen. */
let neueGruppen = 0;

/**
 * Führt einen Simulationsschritt aus: entweder eine neue Gruppe anlegen
 * oder Punkte auf eine zufällige Gruppe buchen.
 *
 * @param {number} neuProzent Wahrscheinlichkeit (0–100) für eine neue Gruppe.
 * @returns {Promise<void>}
 */
async function schritt(neuProzent) {
  const { groups } = await api('GET', '/api/groups');

  if (groups.length === 0 || Math.random() * 100 < neuProzent) {
    neueGruppen++;
    const gruppe = await api('POST', '/api/groups', { name: `Simulation ${Date.now() % 100000}-${neueGruppen}` });
    console.log(`+ neue Gruppe «${gruppe.name}»`);
    return;
  }

  const gruppe = zufaellig(groups);
  const punkte = zufaellig(PUNKTE);
  const ergebnis = await api('POST', `/api/groups/${gruppe.id}/points`, { points: punkte });
  console.log(`${punkte > 0 ? '+' : ''}${punkte} für «${ergebnis.name}» → ${ergebnis.score}`);
}

/**
 * Startet die Simulation in einer Endlosschleife.
 * @returns {Promise<void>}
 */
async function main() {
  const intervall = leseZahl('--intervall', 2000);
  const neuProzent = leseZahl('--neu', 0);
  console.log(`Simulation gegen ${BASE_URL}, alle ${intervall} ms. Beenden mit Ctrl+C.`);

  for (;;) {
    try {
      await schritt(neuProzent);
    } catch (err) {
      console.error(`Fehler: ${err.message}${err.cause ? ' (läuft der Server? npm run dev)' : ''}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervall));
  }
}

main();
