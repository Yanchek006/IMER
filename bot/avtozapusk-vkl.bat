@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist .env (
  echo Нет файла .env с токеном. Сначала запустите zapusk.bat.
  pause
  exit /b
)
if not exist .venv\Scripts\pythonw.exe (
  echo Сначала один раз запустите zapusk.bat: он поставит библиотеки.
  echo Когда бот ответит в Telegram, закройте то окно и запустите этот файл снова.
  pause
  exit /b
)

rem Ярлык в автозагрузке: бот сам стартует при каждом входе в Windows, без окна
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup')+'\IMER-bot.lnk'); $s.TargetPath=$env:WINDIR+'\System32\wscript.exe'; $s.Arguments=[char]34+(Resolve-Path 'fon.vbs').Path+[char]34; $s.WorkingDirectory=(Get-Location).Path; $s.Description='IMER Telegram bot'; $s.Save()"

rem Запускаем прямо сейчас
wscript.exe "%~dp0fon.vbs"

echo.
echo Готово. Бот работает в фоне и будет запускаться сам при включении компьютера.
echo Окно терминала больше не нужно. Журнал работы: bot.log в папке бота.
echo Выключить автозапуск и остановить бота: avtozapusk-vykl.bat
pause
