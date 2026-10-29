# Installation & lokaler Start

Diese Anleitung führt Schritt für Schritt von einem frischen Windows-Rechner bis zur laufenden Anwendung unter `http://localhost:3000`. Git wird nur benötigt falls entwickelt werden muss.

| Seite | Adresse |
|---|---|
| Erfassung | http://localhost:3000/ |
| Rangliste | http://localhost:3000/rangliste |

---

## Inhalt

- [Installation \& lokaler Start](#installation--lokaler-start)
  - [Inhalt](#inhalt)
  - [1. Überblick: Was wird gebraucht?](#1-überblick-was-wird-gebraucht)
  - [2. Node.js installieren](#2-nodejs-installieren)
    - [Variante A: Mit Admin-Rechten](#variante-a-mit-admin-rechten)
    - [Variante B: Ohne Admin-Rechte](#variante-b-ohne-admin-rechte)
    - [Prüfen](#prüfen)
  - [3. Anwendung starten und beenden](#3-anwendung-starten-und-beenden)
    - [Start](#start)
    - [Beenden](#beenden)
  - [4. Einstellungen](#4-einstellungen)
  - [5. Testdaten und Vorführmodus (optional)](#5-testdaten-und-vorführmodus-optional)
    - [Testdaten laden](#testdaten-laden)
    - [Vorführmodus (Simulation)](#vorführmodus-simulation)
    - [Funktionsprüfung](#funktionsprüfung)
  - [6. Mit Tablet oder zweitem Gerät verbinden](#6-mit-tablet-oder-zweitem-gerät-verbinden)
  - [7. Neue Version installieren](#7-neue-version-installieren)
  - [8. Fehlerbehebung](#8-fehlerbehebung)

---

## 1. Überblick: Was wird gebraucht?

| Was | Wozu |
|---|---|
| **Node.js** (mind. Version 22.13) | Führt die Anwendung aus. Enthält **npm** (lädt benötigte Bausteine herunter) und die eingebaute Datenbank |
| **Die Anwendung** als ZIP-Datei | Programmdateien |
| Internetzugang | Nur für den ersten Start bzw. nach Updates |

Eine separate Datenbank, Git oder Docker sind **nicht** nötig.

> **Firmenrechner:** Für die normale Installation von Node.js braucht es Admin-Rechte. Es ist deshalb auch ein Weg **ohne Admin-Rechte** beschrieben.

---

## 2. Node.js installieren

### Variante A: Mit Admin-Rechten

Mit PowerShell oder cmd:
```cmd
winget install OpenJS.NodeJS.LTS
```

Alternativ manuelle installation:
1. Auf https://nodejs.org die **LTS**-Version für Windows herunterladen (Windows Installer, `.msi`).
2. Installer ausführen und alle Vorgaben übernehmen.

### Variante B: Ohne Admin-Rechte

1. Auf https://nodejs.org/en/download die **LTS-Version** als **Windows Binary (.zip)**, **x64** herunterladen.
2. Entpacken, z. B. nach `C:\Users\<Name>\nodejs`.
   **Wichtig:** `node.exe` muss **direkt** in diesem Ordner liegen. Beim Entpacken entsteht oft ein Unterordner (`node-v…-win-x64`). Dann dessen Inhalt eine Ebene nach oben verschieben.
3. Ordner zum **Benutzer-Path** hinzufügen:
   - Startmenü → «**Umgebungsvariablen für dieses Konto bearbeiten**» (nicht «Systemumgebungsvariablen»)
   - Im **oberen** Bereich `Path` markieren → **Bearbeiten** → **Neu** → `C:\Users\<Name>\nodejs` → **OK** → **OK**

### Prüfen

Ein **neues** Terminal öffnen (Startmenü → «cmd» → **Eingabeaufforderung**) und eingeben:
```cmd
node -v
npm -v
```
Es müssen zwei Versionsnummern erscheinen. `node -v` muss **v22.13 oder höher** anzeigen.

---

## 3. Anwendung starten und beenden

### Start

Solange Node.JS wie in [Schritt 2](#2-nodejs-installieren) beschrieben installiert ist, kann die Anwendung über `start.cmd` gestartet werden.

Bem ersten Start wird die Installation abgeschlossen, dies kann ca. 1 Minute dauern je nach Internet.

Zusätzlich werden diverse Einstellungen bei jedem Start abgefragt. [Siehe Schritt 5](#5-einstellungen)

### Beenden

Die Anwendung wird beendet durch schliessen des cmd Fensters, welches beim Start öffnet.

Alle Gruppen und Punkte werden lokal unter `data\rangliste.db` gespreichert und bleiben bei einem Neustart bestehen.

---

## 4. Einstellungen

Beim Start werden dieverse Einstellungen abgefragt:

- **Admin Pin**: Dieser Pin ist in erster Linie dazu da um kritische Aktionen, wie das löschen aller Gruppen, durch einen Pin / ein Passwort zu schützen.
- **Andwenung durch Pin sperren**: Ist diese Option aktiv, muss auch beim öffnen der Webseite der Admin Pin eingegeben werden. Ist für Localhost nicht notwendig.
- **Titel der Anwendung**: Dies ist die Überschrift welche sowie auf der ERfasung wie auch der Rangliste angezeigt wird.
- **Port**: Localhost Port

---

## 5. Testdaten und Vorführmodus (optional)

Diese Befehle werden im Terminal im Anwendungsordner ausgeführt.

### Testdaten laden

> **Achtung:** Löscht alle bestehenden Gruppen und Punkte!

```cmd
npm run seed
```
Lädt Beispielgruppen mit Punkten. Weitere Möglichkeiten:

| Befehl | Wirkung |
|---|---|
| `npm run seed -- --anzahl 30` | Alles löschen, dann bis 30 Gruppen auffüllen |
| `npm run seed -- --behalten` | Bestehende Daten behalten, Beispielgruppen ergänzen |
| `npm run seed -- --leer` | Alle Daten löschen |

Läuft die Anwendung bereits, die Seiten im Browser danach neu laden (`F5`).

### Vorführmodus (Simulation)

Bucht laufend zufällige Punkte, z. B. um die Ranglisten-Anzeige vorzuführen. Die Anwendung muss dafür bereits laufen. Deshalb ein **zweites** Terminal im Anwendungsordner öffnen (siehe Schritt 4):
```cmd
set ADMIN_PIN=<Definierter Admin Pin aus start.cmd>
npm run simulate
```
Beenden mit `Ctrl+C`. Die simulierten Punkte bleiben gespeichert. Danach ggf. mit `npm run seed -- --leer` aufräumen.

### Funktionsprüfung

```cmd
npm test
```
Prüft die Anwendung automatisch. Die Ausgabe muss mit `# fail 0` enden. Bestehende Daten werden dabei nicht verändert.

---

## 6. Mit Tablet oder zweitem Gerät verbinden

1. Tablet und Rechner müssen im **gleichen Netzwerk** (WLAN) sein.
2. Auf dem Tablet die Adresse aus dem Terminal öffnen: `Im Netzwerk: http://192.168.x.x:3000/`
3. Fragt Windows beim ersten Start nach der Firewall, **Private Netzwerke** zulassen.

Erreicht das Tablet die Seite nicht:
- Die Windows-Firewall blockiert den Zugriff. Auf Firmenrechnern muss die Freigabe meist durch die IT erfolgen.
- Firmen- und Gäste-WLANs trennen Geräte oft voneinander. Dann ein anderes Netz verwenden, z. B. einen Handy-Hotspot.

**Tipp:** Auf dem Tablet die Erfassungsseite zum Startbildschirm hinzufügen. Dann öffnet sie sich wie eine App ohne Adressleiste.

---

## 7. Neue Version installieren

1. Anwendung beenden.
2. Neue ZIP-Datei herunterladen und **in einen neuen Ordner** entpacken (siehe Schritt 3).
3. Die bisherigen Daten übernehmen: Die Datei `data\rangliste.db` aus dem alten Ordner in den Ordner `data` des neuen Ordners **kopieren**.
4. Wie gewohnt starten. Der alte Ordner kann gelöscht werden, sobald alles funktioniert.

> Eine neue Version kann die Datenbank beim ersten Start automatisch erweitern. Die bestehenden Daten bleiben dabei erhalten. Die Kopie im alten Ordner dient trotzdem als Sicherung.

---

## 8. Fehlerbehebung

| Problem | Ursache / Lösung |
|---|---|
| `'node'` bzw. `'npm'` wird nicht erkannt | Node.js ist nicht installiert oder nicht im Path. Nach der Installation **alle** Terminal-Fenster schliessen und neu öffnen (siehe Schritt 2) |
| `Die Ausführung von Skripts ist auf diesem System deaktiviert` | Das Terminal ist PowerShell. Stattdessen die Eingabeaufforderung (cmd) verwenden (siehe Schritt 4) |
| `npm ERR! enoent … package.json` | Terminal ist nicht im Anwendungsordner. Prüfen mit `dir package.json` (siehe Schritt 3 und 4) |
| `Cannot find module 'express'` | `npm install` wurde noch nicht ausgeführt (Schritt 5) |
| `No such built-in module: node:sqlite` | Node.js ist zu alt. `node -v` muss ≥ 22.13 sein, sonst neu installieren |
| `npm install` hängt oder meldet Zertifikatsfehler (`SELF_SIGNED_CERT_IN_CHAIN`) | Ein Firmen-Proxy blockiert den Download. Die IT nach den Proxy-Einstellungen für npm fragen oder ein anderes Netz verwenden |
| `EADDRINUSE: address already in use :::3000` | Die Anwendung läuft bereits in einem anderen Fenster. Dieses verwenden oder schliessen. Alternativ anderen Port wählen: `set PORT=3001` |
| Seite zeigt alte Version | Im Browser `Ctrl+F5` drücken |
| PIN wird nie abgefragt | `ADMIN_PIN` wurde nicht gesetzt. Beim Start erscheint dann `Hinweis: Keine ADMIN_PIN gesetzt` |


