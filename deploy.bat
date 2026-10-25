@echo off
rem Backs up the live database, applies new migrations, builds and deploys to Cloudflare.
cd /d "%~dp0"

where node >nul 2>nul || (
  echo Node.js is not installed. Get the LTS version from https://nodejs.org and try again.
  goto fail
)
if not exist data\challenges.json (
  echo The challenge data and pictures are missing. Run game-files.bat first.
  goto fail
)
if not exist node_modules (
  echo Installing libraries...
  call npm install || goto fail
)

echo.
echo === 1/3 Backing up the live database to backups\tta-challenges-latest.sql
call npm run db:backup:remote || goto fail

echo.
echo === 2/3 Applying new database migrations (if any)
call npm run db:migrate:remote || goto fail

echo.
echo === 3/3 Building and uploading
call npm run deploy || goto fail

echo.
echo Done. Live at https://tta-challenges.olesch.workers.dev
echo Don't forget to commit your changes in git.
pause
exit /b 0

:fail
echo.
echo Deploy stopped. Nothing after the failed step was done; read the message above.
pause
exit /b 1
