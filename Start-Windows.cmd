@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Bitte zuerst Node.js ab Version 22.12 installieren: https://nodejs.org/en/download
  pause
  exit /b 1
)
node scripts\check-node.cjs
if errorlevel 1 (
  echo Node.js ist zu alt. Bitte Version 22.12 oder neuer installieren.
  pause
  exit /b 1
)
if not exist node_modules\ (
  echo Abhaengigkeiten werden einmalig installiert ...
  call npm ci
  if errorlevel 1 goto failed
)
if not exist dist\server\server\index.js (
  call npm run build
  if errorlevel 1 goto failed
)
echo.
echo Spiel nach dem Serverstart unter http://localhost:2567 oeffnen.
echo Dieses Fenster waehrend des Spielens geoeffnet lassen.
call npm start
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo Der Start wurde abgebrochen. Bitte die Fehlermeldung oben pruefen.
pause
exit /b 1
