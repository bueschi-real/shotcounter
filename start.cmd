@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

rem Node.js vorhanden?
where node >nul 2>&1
if errorlevel 1 (
  echo [FEHLER] Node.js wurde nicht gefunden.
  echo Bitte Node.js installieren, siehe README.md, Schritt 2.
  goto :ende
)

rem Node.js-Version ausreichend (mind. 22.13)?
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"
if errorlevel 1 (
  echo [FEHLER] Node.js ist zu alt. Benötigt wird mindestens Version 22.13.
  echo Installierte Version:
  node -v
  goto :ende
)

rem  "npm ls" meldet einen Fehler, wenn Pakete fehlen oder nicht zur
rem  package.json passen (z. B. nach einem Update der Anwendung).
call npm ls >nul 2>&1
if errorlevel 1 (
  echo Abhängigkeiten fehlen oder sind veraltet. Führe "npm install" aus ...
  call npm install
  if errorlevel 1 (
    echo [FEHLER] "npm install" ist fehlgeschlagen. Internetverbindung prüfen.
    goto :ende
  )
)

rem Einstellungen abfragen
set "ADMIN_PIN="
set /p ADMIN_PIN=Admin-PIN definieren (leer = kein PIN-Schutz): 

if not defined ADMIN_PIN (
  echo Hinweis: Ohne PIN ist auch "Alle Gruppen löschen" nicht geschützt.
  set PIN_MODE=critical
  goto :titel
)

:mode
set "MODE_INPUT="
set /p MODE_INPUT=Soll die ganze Erfassung mit der PIN gesperrt werden? (J/N): 
if /i "%MODE_INPUT%"=="j" (
  set PIN_MODE=all
) else if /i "%MODE_INPUT%"=="n" (
  set PIN_MODE=critical
) else (
  goto :mode
)

:titel
set APP_TITLE=Sprützerball Shotcounter
set /p APP_TITLE=Titel der Anwendung (Standard: %APP_TITLE%): 

set PORT=3000
set /p PORT=Port (Standard: %PORT%): 

rem Anwendung starten
echo.
echo Anwendung wird gestartet. Zum Beenden dieses Fenster schliessen oder Ctrl+C drücken.
echo.
call npm start

:ende
echo.
pause
endlocal