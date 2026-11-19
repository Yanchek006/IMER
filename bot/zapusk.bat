@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist .env (
  copy .env.example .env >nul
  echo Создан файл .env. Впишите BOT_TOKEN и ADMIN_IDS, сохраните и запустите start.bat снова.
  notepad .env
  pause
  exit /b
)

rem ---- ищем настоящий Python (не заглушку Microsoft Store) ----
set "PY="
if exist "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" set "PY=%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
if not defined PY if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if not defined PY if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" set "PY=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
if not defined PY if exist "%ProgramFiles%\Python313\python.exe" set "PY=%ProgramFiles%\Python313\python.exe"
if not defined PY (
  py -3 --version >nul 2>&1 && set "PY=py -3"
)
if not defined PY (
  echo Не нашёл Python. Установите Python 3.11 или новее с python.org и запустите start.bat снова.
  pause
  exit /b
)

rem ---- если прошлый запуск оборвался, удаляем недоделанное окружение ----
if exist .venv if not exist .venv\Scripts\python.exe rmdir /s /q .venv

if not exist .venv\Scripts\python.exe (
  echo Первый запуск: ставлю библиотеки, это займёт минуту...
  %PY% -m venv .venv
  if not exist .venv\Scripts\python.exe (
    echo Не получилось создать окружение. Сделайте скриншот этого окна и пришлите.
    pause
    exit /b
  )
  .venv\Scripts\python -m pip install --upgrade pip >nul
  .venv\Scripts\python -m pip install -r requirements.txt
  if errorlevel 1 (
    echo Не удалось поставить библиотеки. Проверьте интернет и запустите start.bat снова.
    rmdir /s /q .venv
    pause
    exit /b
  )
)

echo Бот запускается. Не закрывайте это окно, пока бот должен работать.
.venv\Scripts\python bot.py
pause
