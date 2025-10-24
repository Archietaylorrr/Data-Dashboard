@echo off
echo ================================================
echo   Water Chemistry Dashboard Launcher
echo ================================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Download the LTS version and install it.
    echo.
    pause
    exit /b 1
)

echo Node.js found: 
node --version
echo NPM version: 
npm --version
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    echo This may take a few minutes on first launch.
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo ERROR: Failed to install dependencies!
        echo.
        pause
        exit /b 1
    )
    echo.
    echo Dependencies installed successfully!
    echo.
)

echo Starting Water Chemistry Dashboard...
echo.
echo The application window will open shortly.
echo You can close this console window after the app launches.
echo.

REM Start the Electron app
call npm start

pause

