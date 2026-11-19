@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\IMER-bot.lnk"
if exist "%LNK%" del "%LNK%"

rem Останавливаем фоновый бот (только наш bot.py, другие программы на Python не трогаем)
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'pythonw.exe' -or $_.Name -eq 'python.exe') -and $_.CommandLine -like '*imer*bot.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"

echo Автозапуск выключен, бот остановлен.
echo Запустить снова: avtozapusk-vkl.bat ^(в фоне^) или zapusk.bat ^(в окне^).
pause
