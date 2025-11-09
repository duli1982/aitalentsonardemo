@echo off
echo ========================================
echo   TALENT SONAR AI - Quick Start
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo [1/3] Installing dependencies...
    echo This may take 30-60 seconds...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo ERROR: npm install failed!
        echo Please make sure Node.js is installed.
        echo Download from: https://nodejs.org/
        pause
        exit /b 1
    )
    echo.
    echo Dependencies installed successfully!
    echo.
) else (
    echo [1/3] Dependencies already installed. Skipping...
    echo.
)

REM Check if .env.local has real API key
findstr /C:"PLACEHOLDER_API_KEY" .env.local >nul
if %errorlevel% equ 0 (
    echo [2/3] WARNING: Using placeholder API key
    echo.
    echo AI features will NOT work without a real API key!
    echo.
    echo To get a FREE API key:
    echo 1. Visit: https://ai.google.dev/
    echo 2. Click "Get API Key"
    echo 3. Sign in with Google
    echo 4. Copy the key
    echo 5. Edit .env.local and replace PLACEHOLDER_API_KEY
    echo.
    echo Press any key to continue anyway...
    pause >nul
) else (
    echo [2/3] API key detected in .env.local
    echo.
)

echo [3/3] Starting development server...
echo.
echo The app will open at: http://localhost:3000
echo.
echo Press Ctrl+C to stop the server when done.
echo.
echo ========================================
echo.

REM Start the dev server
call npm run dev
