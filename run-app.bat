@echo off
setlocal
set ADMIN_PORT=5000
set STORE_PORT=5001
call :resolve_node
if errorlevel 1 exit /b 1

echo Building frontend...
pushd "%~dp0client"
"%NODE_EXE%" "node_modules\vite\bin\vite.js" build
if errorlevel 1 (
  popd
  echo Build failed.
  exit /b 1
)
popd

echo Starting admin on http://localhost:%ADMIN_PORT%/admin ...
echo Starting store on http://localhost:%STORE_PORT%/store ...
pushd "%~dp0server"
"%NODE_EXE%" "src\server.js"
popd
exit /b 0

:resolve_node
set "NODE_EXE=C:\Progra~1\nodejs\node.exe"
if exist "%NODE_EXE%" goto :eof
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required but was not found.
  echo Install Node.js 20+ from https://nodejs.org and reopen this terminal.
  exit /b 1
)
set "NODE_EXE=node"
goto :eof
