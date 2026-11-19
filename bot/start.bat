@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .env (
  copy .env.example .env >nul
  echo Создан файл .env. Откройте его, впишите BOT_TOKEN и ADMIN_IDS, затем запустите start.bat снова.
  notepad .env
  pause
  exit /b
)
if not exist .venv (
  echo Первый запуск: ставлю библиотеки, это займёт минуту...
  python -m venv .venv
  .venv\Scripts\python -m pip install --upgrade pip >nul
  .venv\Scripts\python -m pip install -r requirements.txt
)
echo Бот запускается. Не закрывайте это окно, пока бот должен работать.
.venv\Scripts\python bot.py
pause
