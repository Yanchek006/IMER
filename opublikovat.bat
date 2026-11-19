@echo off
chcp 65001 >nul
cd /d "%~dp0"
setlocal

rem Публикует сайт и код бота в https://github.com/Yanchek006/IMER
rem Через минуту после публикации сайт обновится на https://yanchek006.github.io/IMER/
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

git config user.name >nul 2>&1 || git config user.name "Yanchek006"
git config user.email >nul 2>&1 || git config user.email "Yanchek006@users.noreply.github.com"

rem Настройка автопубликации сайта на GitHub Pages (папку .github создаём отсюда)
if not exist .github\workflows mkdir .github\workflows
copy /y github-pages.yml .github\workflows\pages.yml >nul

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
if errorlevel 1 (
  git commit -q -m "Обновление сайта %date% %time:~0,5%"
) else (
  echo Новых изменений нет, проверяю, всё ли уже отправлено...
)

echo Отправляю в GitHub. Если откроется окно входа — войдите в аккаунт Yanchek006.
git push -u origin main
if errorlevel 1 (
  echo.
  echo В репозитории на GitHub уже есть файлы, которых нет здесь. Объединяю...
  git pull --no-rebase --no-edit --allow-unrelated-histories -X ours origin main
  git push -u origin main
)
if errorlevel 1 (
  echo.
  echo Не получилось отправить. Сделайте скриншот этого окна и пришлите Claude.
) else (
  echo.
  echo Готово. Сайт обновится через 1-2 минуты: https://yanchek006.github.io/IMER/
)
pause
