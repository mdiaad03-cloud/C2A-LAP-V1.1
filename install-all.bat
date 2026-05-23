@echo off
setlocal
set "NPM_CMD=C:\Program Files\nodejs\npm.cmd"
if exist "%NPM_CMD%" goto :run
where npm >nul 2>nul
if errorlevel 1 (
  echo npm is required but was not found.
  echo Install Node.js 20+ from https://nodejs.org and reopen this terminal.
  exit /b 1
)
set "NPM_CMD=npm"

:run
"%NPM_CMD%" run install:all
