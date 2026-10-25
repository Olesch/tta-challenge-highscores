@echo off
rem Regenerates the challenge data and pictures from the installed game (they are not in git).
rem Usage: game-files.bat ["D:\Games\GOG\Through the Ages"]
cd /d "%~dp0"

where py >nul 2>nul && (set PY=py) || (set PY=python)
%PY% -c "import yaml, PIL" >nul 2>nul || (
  echo Installing the Python libraries pyyaml and pillow...
  %PY% -m pip install pyyaml pillow || goto fail
)
%PY% tools\generate_game_files.py %* || goto fail

echo.
echo Done.
pause
exit /b 0

:fail
echo.
echo Stopped; read the message above. Python 3 is needed: https://www.python.org
pause
exit /b 1
