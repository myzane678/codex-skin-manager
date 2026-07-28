@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules\" (
  echo node_modules was not found. Run npm install in this folder first.
  pause
  exit /b 1
)

call npm run start
set "exitCode=%errorlevel%"

if not "%exitCode%"=="0" (
  echo.
  echo Startup failed with exit code %exitCode%.
  pause
)

exit /b %exitCode%
