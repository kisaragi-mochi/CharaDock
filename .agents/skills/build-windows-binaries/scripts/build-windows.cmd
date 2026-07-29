@echo off
setlocal

set "CHARADOCK_NODE=C:\Program Files\nodejs\node.exe"
if not exist "%CHARADOCK_NODE%" (
  set "CHARADOCK_NODE="
  for /f "delims=" %%N in ('where node 2^>nul') do if not defined CHARADOCK_NODE set "CHARADOCK_NODE=%%N"
)
if not defined CHARADOCK_NODE (
  echo Windows node.exe was not found. 1>&2
  exit /b 1
)

pushd "%~dp0..\..\..\.." || exit /b 1
if not exist "node_modules\electron-builder\out\cli\cli.js" (
  echo electron-builder dependencies are missing. Run npm install in WSL first. 1>&2
  popd
  exit /b 1
)

"%CHARADOCK_NODE%" node_modules\electron-builder\out\cli\cli.js --win nsis portable
set "CHARADOCK_BUILD_EXIT=%ERRORLEVEL%"
popd
exit /b %CHARADOCK_BUILD_EXIT%
