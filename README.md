# IMER — сайт студии и Telegram-бот

Сайт: https://yanchek006.github.io/IMER/
Бот: [@imerbot_bot](https://t.me/imerbot_bot)

## Что здесь

```
site/      сайт: обычные HTML, CSS и JS, без сборки
bot/       Telegram-бот на aiogram 3
.github/   автопубликация site/ на GitHub Pages
```

Документы, исходники макетов и материалы для Instagram в репозиторий не попадают (см. `.gitignore`).

## Как обновить сайт

1. Поменяйте файлы в `site/`.
2. Дважды кликните `opublikovat.bat`.
3. Через 1–2 минуты изменения появятся на сайте.

Посмотреть сайт до публикации: откройте `site/index.html` в браузере или запустите в папке `site` команду `python -m http.server 8000` и откройте http://localhost:8000.

## Заявки

Бриф на сайте и бот отправляют заявки в Google Таблицу через Apps Script. Ссылка на него — в первой строке `site/assets/js/app.js`. Код скрипта с защитой от спама и формул хранится у владельца в `docs/zayavki-podklyuchenie.md`.

## Бот

Подробности — в `bot/README.md`. Коротко:

- `bot/zapusk.bat` — первый запуск в окне: ставит библиотеки, создаёт `.env`.
- `bot/avtozapusk-vkl.bat` — бот работает в фоне и сам стартует при включении компьютера.
- `bot/avtozapusk-vykl.bat` — остановить бота и выключить автозапуск.

Токен бота хранится только в `bot/.env` на компьютере. Этот файл в GitHub не отправляется.
