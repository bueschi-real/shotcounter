# Rangliste

Live-Rangliste für den Gastrobetrieb: Gruppen werden auf einem **Tablet erfasst** und auf einem **separaten Bildschirm** angezeigt. Die Anzeige aktualisiert sich ohne jede Bedienung.

| Seite | URL | Gerät |
|---|---|---|
| Erfassung | `http://<IP>:8080/` | Tablet |
| Rangliste | `http://<IP>:8080/rangliste` | Bildschirm / TV |

**Technik:** Node.js · Express · SQLite (in Node.js eingebaut) · reines HTML/CSS/JavaScript · Server-Sent Events · Docker

---

## Inhalt

1. [Funktionen](#1-funktionen)
2. [Lokal entwickeln](#2-lokal-entwickeln)
3. [Projektstruktur](#3-projektstruktur)
4. [Architektur](#4-architektur)
5. [Konfiguration](#5-konfiguration)
6. [REST-API](#6-rest-api)
7. [Erweitern: Anleitungen](#7-erweitern-anleitungen)
8. [Deployment auf dem NAS](#8-deployment-auf-dem-nas)
9. [Betrieb, Backup & Sicherheit](#9-betrieb-backup--sicherheit)
10. [Fehlerbehebung](#10-fehlerbehebung)

---

## 1. Funktionen

**Erfassung (Tablet)**
- Neue Gruppe anlegen: Name eingeben, Enter oder «Anlegen». Startet mit 0 Punkten.
- Schnellbuttons **+1 / +5 / +10** auf jeder Gruppenkarte.
- **±…** öffnet einen Ziffernblock für beliebige Werte, auch Abzüge.
- **Rückgängig** macht die letzte Buchung rückgängig (auch direkt in der Meldung nach dem Buchen).
- **✎** öffnet den Dialog zum Umbenennen oder Löschen.
- Suche, Sortierung (A–Z / Punkte / Neueste).
- Menü: Rangliste öffnen, **Neue Runde** (alle Punkte auf 0), alle Gruppen löschen.
- PIN-Schutz (optional): Standardmässig nur für kritische Aktionen wie «Alle Gruppen löschen», dort jedes Mal neu. Mit `PIN_MODE=all` zusätzlich beim Start der Erfassung für alle Änderungen.
- Helles/dunkles Design nach Systemeinstellung.
- Mehrere Tablets gleichzeitig möglich, alle sehen live denselben Stand.

**Rangliste (Bildschirm)**
- Sortiert nach Punkten. Gleichstand ergibt denselben Rang (1, 2, 2, 4).
- Podest-Farben für die Plätze 1–3.
- Animierte Rangwechsel, Hervorhebung der zuletzt geänderten Gruppe mit «+5»-Anzeige.
- Automatische Verteilung auf bis zu 3 Spalten, Schriftgrösse passt sich an.
- Uhr, Verbindungsanzeige, Mauszeiger blendet sich aus.
- Verbindet sich nach Unterbrüchen (WLAN, NAS-Neustart) selbst neu.

---

## 2. Lokal entwickeln

### Voraussetzungen

- **Node.js 22.13 oder neuer** (empfohlen: aktuelle LTS-Version, https://nodejs.org)
- **VS Code** (beim Öffnen des Ordners werden passende Erweiterungen vorgeschlagen)
- Optional: Docker Desktop, Rancher Desktop oder Podman Desktop für den Docker-Test

### Starten

```bash
npm install        # einmalig: Abhängigkeiten installieren
npm run dev        # Server starten, startet bei Änderungen automatisch neu
```

Danach im Browser öffnen:
- Erfassung: http://localhost:3000/
- Rangliste: http://localhost:3000/rangliste

Ohne gesetzte `ADMIN_PIN` ist die Erfassung lokal ungeschützt. Mit PIN starten:

```bash
# macOS / Linux
ADMIN_PIN=1234 npm run dev
# Windows PowerShell
$env:ADMIN_PIN="1234"; npm run dev
```

In VS Code geht es auch mit **F5** («Rangliste starten (Debug)»). Dann sind Haltepunkte (Breakpoints) im Backend möglich.

**Mit dem Tablet testen:** Beim Start zeigt die Konsole die Netzwerkadresse an (`Im Netzwerk: http://192.168.x.x:3000/`). Unter Windows muss der Port eventuell in der Firewall freigegeben werden.

### Tests

```bash
npm test
```

Die Tests prüfen Rangberechnung, Validierung, PIN-Schutz, Rückgängig, Live-Verbindung und die Auslieferung der Seiten. Sie verwenden eine Datenbank im Arbeitsspeicher, die echten Daten bleiben unberührt.

### Docker lokal testen

```bash
docker compose up --build     # bauen und starten (Port 8080)
docker compose down           # stoppen
```

---

## 3. Projektstruktur

```
rangliste/
├── server.js                    Einstiegspunkt: startet den Server, sauberes Beenden
├── package.json                 Abhängigkeiten und Befehle (npm run dev / start / test)
├── Dockerfile                   Bauanleitung für das Docker-Image
├── docker-compose.yml           Variante A: NAS baut selbst
├── docker-compose.image.yml     Variante B: fertiges Image (.tar) verwenden
│
├── src/                         ── BACKEND ──
│   ├── app.js                   Zusammenbau aller Module (einziger Ort für Verknüpfungen)
│   ├── config.js                Alle Einstellungen aus Umgebungsvariablen
│   ├── db/database.js           Datenbank öffnen, Schema-Migrationen, Transaktionen
│   ├── repositories/
│   │   └── groupRepository.js   NUR SQL: Lesen/Schreiben von Gruppen und Buchungen
│   ├── services/
│   │   ├── groupService.js      Fachlogik: Validierung, Rangberechnung, Ereignisse
│   │   └── eventBus.js          Interner Ereignis-Bus (entkoppelt Logik und Live-Updates)
│   ├── realtime/sseHub.js       Live-Updates an alle Browser (Server-Sent Events)
│   ├── routes/
│   │   ├── groupRoutes.js       REST-Endpunkte /api/groups/…
│   │   └── systemRoutes.js      /api/config, /api/auth/check, /api/events, /api/health
│   ├── middleware/
│   │   ├── requirePin.js        PIN-Schutz für schreibende Aktionen
│   │   └── errorHandler.js      Einheitliche Fehlerantworten
│   └── utils/errors.js          Fehlerklassen (400, 401, 404, 409)
│
├── public/                      ── FRONTEND (wird 1:1 ausgeliefert, kein Build) ──
│   ├── index.html               Erfassung
│   ├── rangliste.html           Anzeige
│   ├── css/
│   │   ├── base.css             Design-Tokens (Farben etc.), Buttons, Dialoge, Meldungen
│   │   ├── erfassung.css        Layout Erfassung
│   │   └── rangliste.css        Layout Anzeige
│   └── js/
│       ├── settings.js          UI-Einstellungen (Schnellbuttons, Animationen …)
│       ├── core/                Grundbausteine ohne Seitenbezug
│       │   ├── api.js           Alle Serveraufrufe
│       │   ├── liveConnection.js  Live-Verbindung mit automatischer Wiederverbindung
│       │   ├── dom.js           Elemente sicher erzeugen (Schutz vor HTML-Einschleusung)
│       │   ├── format.js        Zahlenformat (12’500, +5, −3)
│       │   └── storage.js       Sicherer Zugriff auf localStorage
│       ├── components/          Wiederverwendbare UI-Bausteine
│       │   ├── groupCard.js     Gruppenkarte (Erfassung)
│       │   ├── rankingBoard.js  Ranglisten-Darstellung mit Animationen
│       │   ├── dialog.js        Dialoge: Bestätigen, Text, PIN, Ziffernblock
│       │   ├── toast.js         Kurze Meldungen mit optionaler Aktion
│       │   └── connectionBadge.js  Verbindungsanzeige
│       └── pages/               Ein Controller pro Seite (verbindet die Bausteine)
│           ├── erfassung.js
│           └── rangliste.js
│
├── test/app.test.js             Automatische Tests
└── data/                        Datenbank (rangliste.db). NICHT ins Image / Git
```

---

## 4. Architektur

### Backend: Schichten

```
HTTP-Anfrage
   │
   ▼
routes/          liest Eingaben, ruft Service auf, gibt JSON zurück
   │
   ▼
services/        Validierung, Fachlogik, Rangberechnung ──► eventBus ──► realtime/sseHub ──► alle Browser
   │
   ▼
repositories/    reines SQL
   │
   ▼
db/              SQLite-Datei in ./data
```

**Regeln, die das Projekt erweiterbar halten:**

| Schicht | Darf | Darf nicht |
|---|---|---|
| Routes | Request lesen, Service aufrufen, antworten | SQL ausführen, Logik enthalten |
| Service | Validieren, rechnen, Ereignisse melden | HTTP/Express kennen |
| Repository | SQL | Validieren, Ereignisse melden |
| `app.js` | Module erzeugen und verbinden | Logik enthalten |

Abhängigkeiten werden **übergeben** (z. B. `createGroupService({ db, repo, eventBus, config })`) statt in den Modulen selbst geladen. Dadurch lassen sich Teile in Tests oder bei Umbauten einfach austauschen.

### Live-Updates

1. Jede Änderung im Service ruft `notify()` auf und sendet damit `ranking:changed` an den Ereignis-Bus.
2. Der SSE-Hub schickt daraufhin den **kompletten aktuellen Stand** (Snapshot) an alle verbundenen Browser.
3. Beide Seiten zeichnen sich anhand des Snapshots neu.

Weil immer der ganze Stand geschickt wird, kann kein Update «verloren» gehen. Nach einem Verbindungsabbruch ist die Anzeige sofort wieder korrekt.

### Frontend: Bausteine

```
pages/erfassung.js ──┬── core/api.js            (Aktionen an Server)
                     ├── core/liveConnection.js (Snapshots empfangen)
                     └── components/*           (Karten, Dialoge, Meldungen)
```

Aktionen ändern die Anzeige **nicht direkt**. Sie gehen an den Server, und die Anzeige folgt dem Live-Snapshot. So sind alle Geräte immer synchron.

### Datenmodell

| Tabelle | Spalten | Zweck |
|---|---|---|
| `groups` | id, name (eindeutig, ohne Gross/Klein), score, created_at, updated_at | Gruppen mit aktuellem Punktestand |
| `score_entries` | id, group_id, points, created_at | Protokoll aller Buchungen (für Rückgängig, später Statistiken) |

---

## 5. Konfiguration

### Umgebungsvariablen (docker-compose.yml → `environment`)

| Variable | Standard | Bedeutung |
|---|---|---|
| `ADMIN_PIN` | *(leer)* | Admin-PIN. Leer = kein PIN-Schutz |
| `PIN_MODE` | `critical` | `critical`: PIN nur bei kritischen Aktionen (z. B. alle Gruppen löschen), jedes Mal neu. `all`: zusätzlich PIN beim Start der Erfassung, schützt alle Änderungen |
| `APP_TITLE` | `Rangliste` | Überschrift auf beiden Seiten |
| `PORT` | `3000` | Port im Container (nach aussen: `ports` in Compose) |
| `DATA_DIR` | `./data` bzw. `/app/data` | Ordner der Datenbank |
| `DB_FILE` | `rangliste.db` | Dateiname der Datenbank |
| `MAX_NAME_LENGTH` | `40` | Max. Länge eines Gruppennamens |
| `MAX_POINTS_PER_BOOKING` | `1000` | Max. ±Punkte pro Buchung |
| `HEARTBEAT_MS` | `25000` | Lebenszeichen-Intervall der Live-Verbindung |

### Oberfläche (`public/js/settings.js`)

Schnellbuttons, Vorschlagswerte im Ziffernblock, Standard-Sortierung, Animationsdauern, Spaltenanzahl usw.

### URL-Parameter der Rangliste

| Parameter | Beispiel | Wirkung |
|---|---|---|
| `top` | `/rangliste?top=10` | Nur die ersten 10 anzeigen |
| `theme` | `/rangliste?theme=light` | Helles Design |
| `clock` | `/rangliste?clock=0` | Uhr ausblenden |
| `title` | `/rangliste?title=Quiz-Abend` | Eigene Überschrift |

Kombinierbar: `/rangliste?top=10&theme=light`


### URL-Parameter der Erfassung

| Parameter | Beispiel | Wirkung |
|---|---|---|
| `theme` | `/?theme=light` | Helles Design (ohne Parameter: dunkel) |

Das Design wird für beide Seiten gleich über `public/js/core/theme.js` gesteuert. Die Farben stehen in `public/css/base.css` (Abschnitt «Design-Tokens»): `:root` für hell, `:root[data-theme='dark']` für dunkel.

### Farben

Alle Farben stehen als Variablen oben in `public/css/base.css` (`--color-primary` usw.). Die Podestfarben stehen in `public/css/rangliste.css` (`--gold`, `--silver`, `--bronze`).

---

## 6. REST-API

Alle Antworten im JSON-Format. Ist ein PIN gesetzt, brauchen kritische Aufrufe (Spalte PIN ✔✔) immer den Header `X-Admin-Pin`. Die übrigen schreibenden Aufrufe (✔) brauchen ihn nur bei `PIN_MODE=all`.

| Methode | Pfad | Body | PIN | Antwort |
|---|---|---|---|---|
| GET | `/api/config` | | – | Titel, PIN nötig?, PIN-Modus, Grenzwerte |
| POST | `/api/auth/check` | | Header | `{ ok: true }` oder 401 |
| GET | `/api/events` | | – | Live-Stream (SSE), Ereignis `snapshot` |
| GET | `/api/health` | | – | Status für Docker |
| GET | `/api/groups` | | – | Snapshot (siehe unten) |
| POST | `/api/groups` | `{ "name": "Tisch 4" }` | ✔ | Neue Gruppe (201) |
| PATCH | `/api/groups/:id` | `{ "name": "…" }` | ✔ | Geänderte Gruppe |
| DELETE | `/api/groups/:id` | | ✔ | Gelöschte Gruppe |
| POST | `/api/groups/:id/points` | `{ "points": 5 }` | ✔ | Gruppe mit neuem Stand |
| POST | `/api/groups/undo` | | ✔ | `{ group, points }` |
| POST | `/api/groups/reset` | | ✔ | 204 (alle Punkte = 0) |
| DELETE | `/api/groups` | | ✔✔ | 204 (alles löschen) |

**Snapshot:**
```json
{
  "groups": [
    { "id": 3, "name": "Team Rösti", "score": 37, "rank": 1, "createdAt": "…", "updatedAt": "…" }
  ],
  "canUndo": true,
  "lastChange": { "action": "points", "groupId": 3, "points": 27, "at": "…" },
  "generatedAt": "…"
}
```

**Fehler:** `{ "error": { "code": "VALIDATION_ERROR", "message": "Bitte einen Namen eingeben." } }`
Codes: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `NOT_FOUND` (404), `CONFLICT` (409), `INTERNAL_ERROR` (500).

Beispiel mit curl:
```bash
curl -X POST http://localhost:3000/api/groups -H "Content-Type: application/json" -H "X-Admin-Pin: 1234" -d '{"name":"Tisch 7"}'
```

---

## 7. Erweitern: Anleitungen

### Schnellbuttons ändern (z. B. −1, +1, +2, +5)

`public/js/settings.js` → `quickPoints: [-1, 1, 2, 5]`. Das Kartenlayout passt sich automatisch an.

### Neues Datenbankfeld (Beispiel: Farbe pro Gruppe)

1. **Migration** in `src/db/database.js` am Ende von `MIGRATIONS` anhängen. Bestehende Einträge dabei **nie** ändern:
   ```js
   // Version 2: Farbe pro Gruppe
   `ALTER TABLE groups ADD COLUMN color TEXT;`,
   ```
2. **Repository** (`groupRepository.js`): `color` in `GROUP_COLUMNS` ergänzen und eine Methode `setColor(id, color)` hinzufügen.
3. **Service** (`groupService.js`): Methode `setColor(rawId, rawColor)` mit Validierung und `notify(...)`.
4. **Route** (`groupRoutes.js`): z. B. `router.patch('/:id/color', …)`.
5. **Frontend**: Methode in `core/api.js`, Anzeige in `components/groupCard.js` bzw. `rankingBoard.js`.

Beim nächsten Start wird die Migration auf dem NAS automatisch ausgeführt, die bestehenden Daten bleiben erhalten.

### Neues Modul (Beispiel: Statistik)

1. `src/services/statsService.js` erstellen (z. B. Buchungen pro Stunde aus `score_entries`).
2. `src/routes/statsRoutes.js` erstellen.
3. In `src/app.js` erzeugen und mit `app.use('/api/stats', …)` einhängen.

Bestehende Dateien bleiben unverändert.

### Neue Seite (Beispiel: Siegerehrung)

1. `public/siegerehrung.html` anlegen (Kopf wie `rangliste.html`).
2. `public/js/pages/siegerehrung.js` erstellen und vorhandene Bausteine verwenden (`connectLive`, `api`, `components/*`).
3. Optional: eigenes CSS in `public/css/siegerehrung.css`.

Erreichbar ist die Seite dann unter `/siegerehrung` (ohne `.html`).

### Weitere kritische Aktion mit PIN schützen (Beispiel: einzelne Gruppe löschen)

Kritische Aktionen verlangen die PIN jedes Mal neu, unabhängig von `PIN_MODE`. «Alle Gruppen löschen» dient als Vorlage.

1. **Backend** (`src/routes/groupRoutes.js`): `requireCriticalPin` in die Route einsetzen und die Tabelle oben in der Datei anpassen:
   ```js
   router.delete('/:id', requireCriticalPin, (req, res) => { ... });
   ```
2. **API** (`public/js/core/api.js`): Parameter `pin` ergänzen, wie bei `deleteAll`:
   ```js
   deleteGroup: (id, pin) => request('DELETE', `/api/groups/${id}`, undefined, { pin }),
   ```
3. **Seite** (`public/js/pages/erfassung.js`): die Aktion über `runCriticalAction()` auslösen:
   ```js
   const result = await runCriticalAction({
      title: 'Gruppe löschen?',
      message: 'Die Gruppe wird endgültig gelöscht.',
      confirmLabel: 'Löschen',
      action: (pin) => api.deleteGroup(groupId, pin),
   });
   if (result !== undefined) showToast('Gruppe gelöscht');
   ```
   `runCriticalAction()` zeigt bei gesetzter PIN den PIN-Dialog mit «Abbrechen», sonst eine normale Sicherheitsabfrage.
4. Optional einen Test ergänzen (Vorlage in `test/app.test.js`: «alle Gruppen löschen verlangt die PIN»).

### Auf Live-Änderungen reagieren (Beispiel: Logging)

In `src/app.js`:
```js
const { EVENTS } = require('./services/eventBus');
eventBus.on(EVENTS.RANKING_CHANGED, (change) => console.log('[änderung]', change));
```

### Neuen Dialog bauen

`openDialog()` aus `public/js/components/dialog.js` verwenden. Beispiele sind `confirmDialog`, `promptDialog` und `pointsDialog` in derselben Datei.

---

## 8. Deployment auf dem NAS

Benötigt nur Docker auf dem NAS (Synology: **Container Manager**, QNAP: **Container Station**).

### Variante A (empfohlen): NAS baut selbst

1. Ordner auf das NAS kopieren, z. B. nach `/docker/rangliste`, **ohne** `node_modules/` und **ohne** lokale Daten in `data/`.
   Nötig sind: `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `package.json`, `package-lock.json`, `server.js`, `src/`, `public/` und ein leerer Ordner `data/`.
2. In `docker-compose.yml` die **`ADMIN_PIN` ändern**.
3. Container Manager → **Projekt** → **Erstellen** → Pfad `/docker/rangliste` → vorhandene `docker-compose.yml` verwenden.
4. Aufrufen: `http://<NAS-IP>:8080/` und `http://<NAS-IP>:8080/rangliste`.

Funktioniert auf Intel/AMD- und ARM-NAS gleichermassen, weil direkt auf dem NAS gebaut wird.

**Update:** Geänderte Dateien überschreiben (`data/` nicht anfassen), dann das Projekt neu bauen (Container Manager: Projekt → Aktion → Erstellen). Die Daten bleiben erhalten.

### Variante B: Fertiges Image als .tar

Auf dem eigenen Rechner:
```bash
# ARM-NAS (uname -m auf dem NAS ergibt "aarch64")
docker buildx build --platform linux/arm64 -t rangliste:1.0 -o type=docker,dest=rangliste-arm64.tar .

# Intel/AMD-NAS ("x86_64")
docker build -t rangliste:1.0 .
docker save rangliste:1.0 -o rangliste-amd64.tar
```

Auf dem NAS:
1. Container Manager → **Image** → **Importieren** → `.tar` wählen.
2. Ordner `/docker/rangliste` mit leerem `data/` anlegen. Darin `docker-compose.image.yml` als **`docker-compose.yml`** ablegen.
3. Projekt erstellen.

**Update:** Mit neuer Versionsnummer bauen (`rangliste:1.1`), importieren, die Version in der Compose-Datei anpassen und das Projekt neu erstellen.

---

## 9. Betrieb, Backup & Sicherheit

- **Backup:** Den Ordner `data/` sichern (z. B. mit Hyper Backup). Er enthält die gesamte Datenbank. Für ein konsistentes Backup den Container kurz stoppen oder nachts sichern.
- **Nicht öffentlich machen:** Keine Portweiterleitung im Router. Die PIN ist ein Schutz gegen Neugierige im lokalen Netz, keine starke Authentifizierung.
- **Gäste-WLAN** vom Netz des NAS trennen, sonst ist die Erfassung für Gäste erreichbar.
- **Anzeigebildschirm:** Browser im Vollbild/Kiosk-Modus (z. B. Fully Kiosk Browser, Chrome mit `--kiosk`, Raspberry Pi). Energiesparmodus und Bildschirmschoner des Geräts deaktivieren.
- **Tablet:** Die Erfassungsseite zum Startbildschirm hinzufügen, dann öffnet sie sich wie eine App ohne Adressleiste.
- **Logs:** Container Manager → Container → Protokoll.

---

## 10. Fehlerbehebung

| Problem | Lösung |
|---|---|
| Rangliste zeigt «Keine Verbindung» | NAS erreichbar? Die Seite verbindet sich automatisch neu, sobald der Server wieder da ist |
| Live-Updates kommen verzögert | Läuft ein Reverse-Proxy davor, muss Pufferung für `/api/events` deaktiviert sein (nginx: `proxy_buffering off;`) |
| Container startet nicht, Fehler mit `data` / Rechte | Schreibrechte auf den `data`-Ordner prüfen (File Station → Eigenschaften → Berechtigungen) |
| Port 8080 belegt | In `docker-compose.yml` links einen anderen Port wählen, z. B. `"8090:3000"` |
| PIN vergessen | `ADMIN_PIN` in der Compose-Datei ändern und Projekt neu starten. Tablets fragen dann neu nach |
| `node:sqlite` nicht gefunden (lokal) | Node.js-Version prüfen: `node -v` muss ≥ 22.13 sein |
| Image läuft nicht auf dem NAS («exec format error») | Image für die falsche Architektur gebaut, siehe Variante B bzw. Variante A verwenden |
