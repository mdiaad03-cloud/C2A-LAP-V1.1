@echo off
setlocal
call :resolve_node
if errorlevel 1 exit /b 1

pushd "%~dp0client"
"%NODE_EXE%" "node_modules\vite\bin\vite.js" build
set code=%errorlevel%
popd
exit /b %code%

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
