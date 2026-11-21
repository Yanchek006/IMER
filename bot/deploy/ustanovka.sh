#!/usr/bin/env bash
# Установка бота IMER на сервер (Ubuntu / Debian) — одной командой:
#   curl -fsSL https://raw.githubusercontent.com/Yanchek006/IMER/main/bot/deploy/ustanovka.sh -o u.sh && sudo bash u.sh
#
# Что делает:
#   1) ставит Python и Git;
#   2) скачивает код бота с GitHub в /opt/imer;
#   3) спрашивает токен и ваш Telegram ID и сохраняет их в /opt/imer/bot/.env (видит только сервер);
#   4) запускает бота как службу: работает круглосуточно и сам поднимается после сбоя или перезагрузки;
#   5) раз в 10 минут проверяет GitHub: после opublikovat.bat новые тексты попадут в бота сами.
# Повторный запуск безопасен: обновит код, а настройки предложит оставить.
set -euo pipefail

REPO="https://github.com/Yanchek006/IMER.git"
DIR="/opt/imer"
BOT="$DIR/bot"
USER_NAME="imerbot"
SITE_DEFAULT="https://yanchek006.github.io/IMER"

say()  { printf '\n\033[1;31m●\033[0m %s\n' "$*"; }
fail() { printf '\n\033[1;31mОшибка:\033[0m %s\n' "$*"; exit 1; }
ask()  { local __v; read -r -p "$1" __v </dev/tty || true; printf '%s' "$__v"; }

[ "$(id -u)" -eq 0 ] || fail "запустите от администратора: sudo bash u.sh"
command -v apt-get >/dev/null || fail "нужен сервер с Ubuntu или Debian"

say "1/5 Ставлю Python и Git (1–2 минуты)…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git python3 python3-venv python3-pip ca-certificates curl >/dev/null
timedatectl set-timezone Europe/Moscow 2>/dev/null || true

say "2/5 Скачиваю код бота с GitHub…"
git config --global --add safe.directory "$DIR" 2>/dev/null || true
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch -q origin main && git -C "$DIR" reset -q --hard origin/main
else
  rm -rf "$DIR"; git clone -q --depth 1 --branch main "$REPO" "$DIR"
fi
[ -f "$BOT/bot.py" ] || fail "в репозитории нет bot/bot.py — сначала запустите opublikovat.bat на компьютере"

python3 -m venv "$BOT/.venv"
"$BOT/.venv/bin/pip" install -q --upgrade pip >/dev/null
"$BOT/.venv/bin/pip" install -q -r "$BOT/requirements.txt"

say "3/5 Настройки бота"
KEEP=""
if [ -f "$BOT/.env" ] && grep -q '^BOT_TOKEN=.\+' "$BOT/.env"; then
  KEEP=$(ask "Настройки уже есть. Оставить их? [Д/н]: ")
fi
case "${KEEP,,}" in ""|д|да|y|yes) [ -f "$BOT/.env" ] && grep -q '^BOT_TOKEN=.\+' "$BOT/.env" && KEEP=1 || KEEP="";; *) KEEP="";; esac

if [ -z "$KEEP" ]; then
  echo "Токен возьмите в файле bot\\.env на компьютере (строка BOT_TOKEN=) или в @BotFather."
  echo "При вставке токена символы не видны — так и задумано. Вставьте и нажмите Enter."
  while :; do
    read -r -s -p "BOT_TOKEN: " TOKEN </dev/tty; echo
    TOKEN="$(printf '%s' "$TOKEN" | tr -d '[:space:]')"
    ME=$(curl -s --max-time 15 "https://api.telegram.org/bot${TOKEN}/getMe" || true)
    if printf '%s' "$ME" | grep -q '"ok":true'; then
      NAME=$(printf '%s' "$ME" | sed -n 's/.*"username":"\([^"]*\)".*/\1/p')
      echo "Токен подходит: @$NAME"; break
    fi
    if [ -z "$ME" ]; then echo "Сервер не достучался до Telegram. Проверьте интернет на сервере или выберите сервер в другой стране."; fi
    echo "Токен не подошёл, попробуйте ещё раз."
  done
  ADMINS=$(ask "Ваш Telegram ID (строка ADMIN_IDS= в bot\\.env, можно несколько через запятую): ")
  LEADS=$(ask "Ссылка Google-таблицы для заявок (строка LEADS_URL=, можно пропустить — Enter): ")
  SITE=$(ask "Адрес сайта [Enter — $SITE_DEFAULT]: "); SITE="${SITE:-$SITE_DEFAULT}"
  umask 077
  cat > "$BOT/.env" <<EOF
BOT_TOKEN=$TOKEN
ADMIN_IDS=$ADMINS
SITE_URL=$SITE
LEADS_URL=$LEADS
EOF
  unset TOKEN
fi

say "4/5 Запускаю бота как службу…"
id "$USER_NAME" >/dev/null 2>&1 || useradd -r -s /usr/sbin/nologin "$USER_NAME"
mkdir -p "$BOT/data"
chown -R "$USER_NAME:$USER_NAME" "$DIR"
chmod 600 "$BOT/.env"
install -m 644 "$BOT/deploy/imer-bot.service" /etc/systemd/system/imer-bot.service

# автообновление из GitHub каждые 10 минут
cat > /usr/local/bin/imer-bot-update <<'EOF'
#!/usr/bin/env bash
set -e
cd /opt/imer
git config --global --add safe.directory /opt/imer 2>/dev/null || true
OLD=$(git rev-parse HEAD)
git fetch -q origin main
NEW=$(git rev-parse origin/main)
[ "$OLD" = "$NEW" ] && exit 0
git reset -q --hard origin/main
/opt/imer/bot/.venv/bin/pip install -q -r /opt/imer/bot/requirements.txt
chown -R imerbot:imerbot /opt/imer
systemctl restart imer-bot
echo "Бот обновлён: $OLD -> $NEW"
EOF
chmod 755 /usr/local/bin/imer-bot-update
cat > /etc/systemd/system/imer-bot-update.service <<'EOF'
[Unit]
Description=Обновление бота IMER из GitHub
After=network-online.target
[Service]
Type=oneshot
ExecStart=/usr/local/bin/imer-bot-update
EOF
cat > /etc/systemd/system/imer-bot-update.timer <<'EOF'
[Unit]
Description=Проверять обновления бота IMER каждые 10 минут
[Timer]
OnBootSec=2min
OnUnitActiveSec=10min
[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable -q --now imer-bot-update.timer
systemctl enable -q imer-bot
systemctl restart imer-bot

say "5/5 Проверяю…"
sleep 8
if systemctl is-active -q imer-bot; then
  tail -n 4 "$BOT/bot.log" 2>/dev/null || true
  if tail -n 20 "$BOT/bot.log" 2>/dev/null | grep -qi conflict; then
    echo
    echo "ВНИМАНИЕ: бот ещё запущен на компьютере. Запустите там bot\\avtozapusk-vykl.bat."
  fi
  cat <<'EOF'

Готово: бот работает круглосуточно, компьютер больше не нужен.
Напишите боту /start и проверьте.

Полезные команды на сервере:
  systemctl status imer-bot        — работает ли бот
  tail -n 50 /opt/imer/bot/bot.log — что он делал
  systemctl restart imer-bot       — перезапустить
  imer-bot-update                  — забрать обновления с GitHub прямо сейчас
  nano /opt/imer/bot/.env          — поменять токен/ID (потом systemctl restart imer-bot)
EOF
else
  journalctl -u imer-bot -n 30 --no-pager || true
  fail "бот не запустился. Сделайте скриншот и пришлите Claude."
fi
