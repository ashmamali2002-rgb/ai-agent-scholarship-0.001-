@echo off
title GETSCO Server  -  KEEP THIS WINDOW OPEN
cd /d "%~dp0"

REM Make sure Node.js is on PATH even if launched by double-click
set "PATH=%PATH%;C:\Program Files\nodejs;%ProgramFiles%\nodejs"

echo ===========================================================
echo            GETSCO - Scholarship Intelligence
echo ===========================================================
echo.
echo  Step 1/2: Building the latest code (about 20 seconds)...
echo.
call npm run build
echo.
echo  Step 2/2: Starting the server...
echo.
echo  When you see:  Ready on http://localhost:3000
echo  open that link in your browser.
echo.
echo  KEEP THIS WINDOW OPEN while using the app.
echo  To stop: close this window or press Ctrl+C.
echo ===========================================================
echo.

call npx wrangler pages dev dist --d1=scholarship-agent-production --local --port 3000

echo.
echo -----------------------------------------------------------
echo  The server has stopped. Press any key to close this window.
echo -----------------------------------------------------------
pause >nul
