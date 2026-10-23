/**
 * @file Schnittstelle zum Backend (REST-API).
 *
 * Alle Aufrufe an den Server laufen über dieses Modul. Kommt eine neue
 * Funktion im Backend dazu, wird hier eine passende Methode ergänzt. Die
 * Seiten selbst verwenden nie direkt `fetch`.
 */

import { STORAGE_KEYS } from '../settings.js';
import { readValue } from './storage.js';

/**
 * Fehler aus einem API-Aufruf, mit Statuscode und verständlicher Meldung.
 */
export class ApiError extends Error {
  /**
   * @param {number} status   HTTP-Status (0 = keine Verbindung).
   * @param {string} code     Fehlercode des Servers, z. B. "VALIDATION_ERROR".
   * @param {string} message  Meldung für den Benutzer.
   */
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  /** @returns {boolean} `true`, wenn die PIN fehlt oder falsch ist. */
  get isUnauthorized() {
    return this.status === 401;
  }
}

/**
 * Führt einen HTTP-Aufruf aus und liefert die JSON-Antwort.
 * Die gespeicherte PIN wird automatisch mitgeschickt.
 *
 * @param {string} method  HTTP-Methode (GET, POST, PATCH, DELETE).
 * @param {string} path    Pfad, z. B. "/api/groups".
 * @param {object} [body]  Optionaler Inhalt, wird als JSON gesendet.
 * @param {object} [options]
 * @param {string} [options.pin] PIN, die statt der gespeicherten verwendet wird.
 * @returns {Promise<any>} Antwortdaten (oder `null` bei leerer Antwort).
 * @throws {ApiError}
 */
async function request(method, path, body, { pin } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const usedPin = pin ?? readValue(STORAGE_KEYS.pin);
  if (usedPin) headers['X-Admin-Pin'] = usedPin;

  let response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Keine Verbindung zum Server. Bitte WLAN prüfen.');
  }

  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const err = data?.error ?? {};
    throw new ApiError(response.status, err.code ?? 'ERROR', err.message ?? `Fehler ${response.status}`);
  }
  return data;
}

/**
 * Alle verfügbaren API-Funktionen.
 * Jede Methode entspricht genau einem Endpunkt im Backend.
 */
export const api = {
  /** @returns {Promise<{appTitle:string, pinRequired:boolean, maxNameLength:number, maxPointsPerBooking:number}>} */
  getConfig: () => request('GET', '/api/config'),

  /**
   * Prüft eine PIN, ohne sie zu speichern.
   * @param {string} pin
   * @returns {Promise<{ok: true}>}
   */
  checkPin: (pin) => request('POST', '/api/auth/check', undefined, { pin }),

  /** @returns {Promise<object>} Aktueller Stand (Snapshot). */
  getSnapshot: () => request('GET', '/api/groups'),

  /**
   * @param {string} name
   * @returns {Promise<object>} Neue Gruppe.
   */
  createGroup: (name) => request('POST', '/api/groups', { name }),

  /**
   * @param {number} id
   * @param {string} name
   * @returns {Promise<object>} Geänderte Gruppe.
   */
  renameGroup: (id, name) => request('PATCH', `/api/groups/${id}`, { name }),

  /**
   * @param {number} id
   * @returns {Promise<object>} Gelöschte Gruppe.
   */
  deleteGroup: (id) => request('DELETE', `/api/groups/${id}`),

  /**
   * @param {number} id
   * @param {number} points Positiv oder negativ.
   * @returns {Promise<object>} Gruppe mit neuem Punktestand.
   */
  addPoints: (id, points) => request('POST', `/api/groups/${id}/points`, { points }),

  /** @returns {Promise<{group: object, points: number}>} */
  undo: () => request('POST', '/api/groups/undo'),

  /** @returns {Promise<null>} */
  resetScores: () => request('POST', '/api/groups/reset'),

    /**
   * Löscht alle Gruppen.
   * @param {string} [pin] Frisch eingegebene PIN. Ohne Angabe wird die
   *        gespeicherte PIN verwendet.
   * @returns {Promise<null>}
   */
  deleteAll: (pin) => request('DELETE', '/api/groups', undefined, { pin }),
};
