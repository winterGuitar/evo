@echo off
echo Starting AI Workflow Editor...
echo.

REM Check frontend dependencies
if not exist "ai-workflow-editor\node_modules" (
    echo Installing frontend dependencies...
    cd ai-workflow-editor
    call npm install
    cd ..
)

REM Check backend dependencies
if not exist "serversrc\node_modules" (
    echo Installing backend dependencies...
    cd serversrc
    call npm install
    cd ..
)

echo Starting services...
echo.

REM Start backend service
echo Starting backend service (port 3001)...
start "Backend" cmd /k "cd serversrc && node server.js"

timeout /t 3 >nul

REM Start React dev server
echo Starting React dev server (port 3000)...
start "React" cmd /k "cd ai-workflow-editor && npm start"

echo.
echo All services started!
echo Backend:     http://localhost:3001
echo React:       http://localhost:3000
echo.
echo Please visit: http://localhost:3000
echo.
pause
