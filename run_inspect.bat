@echo off
set "NODE_EXE=C:\Program Files\nodejs\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=C:\Progra~1\nodejs\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"
echo Using Node: %NODE_EXE% > batch_log.txt
"%NODE_EXE%" search_images.js >> batch_log.txt 2>&1
