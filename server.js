/**
 * @file Einstiegspunkt: Startet den Webserver.
 *
 * Start lokal:   npm run dev   (startet bei Änderungen automatisch neu)
 * Start Docker:  npm start     (wird im Dockerfile aufgerufen)
 *
 * Die eigentliche Anwendung wird in `src/app.js` zusammengebaut. Diese Datei
 * kümmert sich nur um Start und sauberes Herunterfahren.
 */

'use strict';

const os = require('node:os');
const config = require('./src/config');
const { createApp } = require('./src/app');

/**
 * Ermittelt die IPv4-Adressen dieses Rechners im lokalen Netz, damit beim
 * Start angezeigt werden kann, unter welcher Adresse das Tablet zugreifen kann.
 *
 * @returns {string[]} Liste von IP-Adressen (ohne 127.0.0.1).
 */
function getLanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === 'IPv4' && !iface.internal)
    .map((iface) => iface.address);
}

/**
 * Startet den Server und registriert das saubere Beenden bei
 * SIGTERM (docker stop) und SIGINT (Ctrl+C).
 *
 * @returns {void}
 */
function start() {
  const { app, shutdown } = createApp(config);

  const server = app.listen(config.port, () => {
    console.log(`[server] ${config.appTitle} läuft auf Port ${config.port}`);
    console.log(`[server] Erfassung:  http://localhost:${config.port}/`);
    console.log(`[server] Rangliste:  http://localhost:${config.port}/rangliste`);
    for (const ip of getLanAddresses()) console.log(`[server] Im Netzwerk: http://${ip}:${config.port}/`);
    if (!config.adminPin) console.log('[server] Hinweis: Keine ADMIN_PIN gesetzt, Erfassung ist ungeschützt.');
  });

  /**
   * Beendet den Server geordnet: Live-Verbindungen schliessen, Datenbank
   * schliessen, dann Prozess beenden.
   *
   * @param {string} signal Name des empfangenen Signals.
   */
  function stop(signal) {
    console.log(`[server] ${signal} empfangen, fahre herunter …`);
    shutdown();
    server.close(() => process.exit(0));
    // Sicherheitsnetz, falls Verbindungen hängen bleiben
    setTimeout(() => process.exit(0), 3000).unref();
  }

  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
}

start();
