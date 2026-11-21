@echo off
chcp 65001 >nul
cd /d "%~dp0"
setlocal

rem Публикует код в https://github.com/Yanchek006/IMER (ветка main),
rem а сам сайт — в ветку gh-pages, откуда его показывает https://yanchek006.github.io/IMER/
rem Секреты (bot\.env), данные клиентов бота, документы и исходники НЕ отправляются: см. .gitignore

set "REPO=https://github.com/Yanchek006/IMER.git"

where git >nul 2>&1
if errorlevel 1 (
  echo Не найден Git. Установите его с https://git-scm.com/download/win
  echo ^(все галочки по умолчанию^), затем запустите этот файл снова.
  pause
  exit /b
)

if not exist .git (
  echo Первая публикация: подключаю репозиторий...
  git init -q
  git remote add origin %REPO%
)
git branch -M main
git config core.autocrlf true
git config user.name >nul 2>&1 || git config user.name "Yanchek006"
git config user.email >nul 2>&1 || git config user.email "Yanchek006@users.noreply.github.com"

rem Папку .github не отправляем: для неё GitHub требует особых прав
if exist .github rmdir /s /q .github

echo Сверяюсь с GitHub...
git fetch -q origin
rem Собираем все неотправленные изменения в одну публикацию поверх того, что уже на GitHub
git rev-parse -q --verify origin/main >nul && git reset -q --soft origin/main

rem Свежая копия КП для бота на сервере (документы в GitHub не уходят, а КП боту нужен)
for %%f in ("docs\IMER*.pdf") do copy /y "%%f" "bot\assets\kp.pdf" >nul

git add -A

rem Защита: если секреты вдруг попали в список, останавливаемся
git diff --cached --name-only | findstr /i /r "\.env$ bot/data/ store\.json" >nul
if not errorlevel 1 (
  echo СТОП: в публикацию попали секретные файлы ^(.env или данные бота^). Ничего не отправлено.
  echo Напишите Claude, он поправит .gitignore.
  git reset -q
  pause
  exit /b
)

git diff --cached --quiet
if errorlevel 1 git commit -q -m "Обновление сайта %date% %time:~0,5%"

echo Отправляю код. Если откроется окно входа — войдите в аккаунт Yanchek006.
git push -u origin main
if errorlevel 1 goto fail

echo Публикую сайт...
set "SPLIT="
for /f %%i in ('git subtree split --prefix site HEAD') do set "SPLIT=%%i"
if not defined SPLIT goto fail
git push -f origin %SPLIT%:refs/heads/gh-pages
if errorlevel 1 goto fail

echo.
echo Готово. Сайт обновится через 1-2 минуты: https://yanchek006.github.io/IMER/
pause
exit /b

:fail
echo.
echo Не получилось отправить. Сделайте скриншот этого окна и пришлите Claude.
pause
