"""Telegram-бот студии IMER.

Что умеет:
  • подобрать услугу за 3 вопроса и назвать цену «от»;
  • показать цены и кейсы (картинки берёт из папки сайта рядом);
  • ответить на сомнения: кнопками или по ключевым словам в свободном тексте;
  • принять заявку за 2 минуты — задачу можно наговорить голосовым;
  • передать вопрос человеку; вы отвечаете ответом (reply) на сообщение бота — ответ уходит клиенту;
  • обучение: тест на 3 вопроса и квест для дизайнеров с подарком-гайдом;
  • заявки приходят вам в Telegram и (по желанию) в ту же Google-таблицу, что и с сайта.

Настройки — в файле .env (см. .env.example). Тексты — в texts.py.
"""
import asyncio
import json
import logging
import os
import re
import sys
from datetime import datetime
from pathlib import Path

import html
import aiohttp
from aiogram import Bot, Dispatcher, F, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.filters import Command, CommandObject, CommandStart, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import (BotCommand, CallbackQuery, FSInputFile, InlineKeyboardButton,
                           InlineKeyboardMarkup, KeyboardButton, Message, ReplyKeyboardMarkup,
                           ReplyKeyboardRemove)

import texts as T

BASE = Path(__file__).resolve().parent
# Лог пишется в bot.log рядом с ботом (до 1 МБ × 3 файла), а если есть окно — ещё и в окно.
# При скрытом запуске (pythonw, автозапуск) окна нет, поэтому лог — единственный способ
# понять, что бот делал.
from logging.handlers import RotatingFileHandler
_handlers = [RotatingFileHandler(Path(__file__).resolve().parent / "bot.log", maxBytes=1_000_000,
                                 backupCount=3, encoding="utf-8")]
if sys.stdout is not None:
    _handlers.append(logging.StreamHandler(sys.stdout))
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", handlers=_handlers)
log = logging.getLogger("imer")


# ---------- настройки ----------
def load_env(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env(BASE / ".env")
TOKEN = os.getenv("BOT_TOKEN", "")
ADMIN_IDS = [int(x) for x in re.findall(r"-?\d+", os.getenv("ADMIN_IDS", ""))]
SITE_URL = os.getenv("SITE_URL", "").rstrip("/")
LEADS_URL = os.getenv("LEADS_URL", "")
IMG_DIR = Path(os.getenv("IMG_DIR", str(BASE.parent / "site" / "assets" / "img")))
# КП: на компьютере берём свежий файл из docs, на сервере — копию bot/assets/kp.pdf
# (её кладёт туда opublikovat.bat при каждой публикации).
_KP_DOCS = BASE.parent / "docs" / "IMER — коммерческое предложение.pdf"
KP_FILE = Path(os.getenv("KP_FILE") or (_KP_DOCS if _KP_DOCS.exists() else BASE / "assets" / "kp.pdf"))
GUIDE_FILE = BASE / "assets" / "guide_infographics.pdf"

if not TOKEN or ":" not in TOKEN:
    log.error("Нет токена. Создайте файл .env по образцу .env.example и впишите BOT_TOKEN.")
    sys.exit(1)
if not ADMIN_IDS:
    log.warning("ADMIN_IDS не указан — заявки некуда пересылать. Напишите боту /myid и впишите число в .env.")


# ---------- маленькое хранилище (переживает перезапуск) ----------
class Store:
    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            self.d = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            self.d = {"users": {}, "leads": 0, "quest": {}}

    def save(self):
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.d, ensure_ascii=False, indent=1), encoding="utf-8")
        tmp.replace(self.path)

    def seen(self, u):
        key = str(u.id)
        if key not in self.d["users"]:
            self.d["users"][key] = {"name": u.full_name, "username": u.username or "",
                                    "since": datetime.now().strftime("%Y-%m-%d %H:%M")}
            self.save()


store = Store(BASE / "data" / "store.json")
router = Router()
NOT_MENU = ~F.text.in_(set(T.BTN.values()))


# ---------- клавиатуры ----------
def main_kb() -> ReplyKeyboardMarkup:
    b = T.BTN
    rows = [[b["pick"], b["prices"]], [b["cases"], b["doubts"]], [b["lead"], b["learn"]], [b["useful"], b["ask"]]]
    return ReplyKeyboardMarkup(keyboard=[[KeyboardButton(text=t) for t in r] for r in rows],
                               resize_keyboard=True, input_field_placeholder="Выберите или напишите вопрос")


def ikb(rows) -> InlineKeyboardMarkup:
    """rows: [[(text, data_or_url), ...], ...]"""
    out = []
    for r in rows:
        line = []
        for text, val in r:
            if val.startswith("http"):
                line.append(InlineKeyboardButton(text=text, url=val))
            else:
                line.append(InlineKeyboardButton(text=text, callback_data=val))
        out.append(line)
    return InlineKeyboardMarkup(inline_keyboard=out)


def cta_rows(extra=None):
    rows = [[("📝 Оставить заявку", "lead:start")], [("🤔 Ещё сомнение", "doubts"), ("💬 Спросить человека", "ask")]]
    if extra:
        rows = extra + rows
    return ikb(rows)


def site(path=""):
    return f"{SITE_URL}/{path}" if SITE_URL else ""


# ---------- служебное ----------
def who(u, plain: bool = False) -> str:
    """Подпись клиента. По умолчанию экранирована для HTML: имя задаёт сам пользователь."""
    at = f"@{u.username}" if u.username else "без username"
    s = f"{u.full_name} ({at}), ID: {u.id}"
    return s if plain else html.escape(s)


def id_tag(u) -> str:
    """Служебная метка в самом конце карточки: по ней бот понимает, кому отвечать.
    Клиент не может её подделать — после неё в сообщении ничего нет."""
    return f"\n\n🆔 {u.id}"


async def notify_admins(bot: Bot, text: str, copy_from: Message | None = None):
    for a in ADMIN_IDS:
        try:
            await bot.send_message(a, text)
            if copy_from:
                await copy_from.forward(a)
        except Exception as e:
            log.error("Не удалось отправить админу %s: %s", a, e)


async def post_sheet(lead: dict):
    if not LEADS_URL:
        return
    try:
        async with aiohttp.ClientSession() as s:
            await s.post(LEADS_URL, data=json.dumps(lead, ensure_ascii=False).encode("utf-8"),
                         headers={"Content-Type": "text/plain;charset=utf-8"}, timeout=aiohttp.ClientTimeout(total=15))
    except Exception as e:
        log.error("Таблица не приняла заявку: %s", e)


async def send_img(m: Message, name: str, caption: str, kb=None):
    p = IMG_DIR / name
    if not p.exists():
        p = BASE / "assets" / name
    if p.exists():
        try:
            await m.answer_photo(FSInputFile(p), caption=caption, reply_markup=kb)
            return
        except Exception as e:
            log.warning("Картинка %s не отправилась: %s", name, e)
    await m.answer(caption, reply_markup=kb)


# ---------- старт ----------
@router.message(CommandStart())
async def start(m: Message, command: CommandObject, state: FSMContext):
    await state.clear()
    store.seen(m.from_user)
    await m.answer(T.WELCOME, reply_markup=main_kb())
    arg = (command.args or "").lower()
    if arg in ("brief", "lead", "zayavka"):
        await lead_start(m, state)
    elif arg == "learn":
        await learn(m, state)
    elif arg == "prices":
        await prices(m, state)


@router.message(Command("myid"))
async def myid(m: Message):
    await m.answer(f"Ваш ID: <code>{m.from_user.id}</code>\nВпишите его в .env в строку ADMIN_IDS.")


@router.message(Command("contacts"))
async def contacts(m: Message):
    rows = [[("🌐 Сайт", site())]] if SITE_URL else []
    await m.answer(T.CONTACTS, reply_markup=ikb(rows) if rows else None)


@router.message(Command("stats"))
async def stats(m: Message):
    if m.from_user.id not in ADMIN_IDS:
        return
    await m.answer(f"Пользователей: {len(store.d['users'])}\nЗаявок через бота: {store.d['leads']}")


@router.message(Command("menu"))
async def menu(m: Message, state: FSMContext):
    await state.clear()
    await m.answer(T.MENU_HINT, reply_markup=main_kb())


# ---------- подбор услуги ----------
class Pick(StatesGroup):
    q = State()


@router.message(F.text == T.BTN["pick"])
async def pick(m: Message, state: FSMContext):
    await state.clear()
    await state.set_state(Pick.q)
    await state.update_data(pick=[])
    await ask_pick(m, 0)


async def ask_pick(m: Message, i: int):
    q, opts = T.PICK_Q[i]
    await m.answer(f"<b>({i + 1}/3) {q}</b>", reply_markup=ikb([[(t, f"pick:{i}:{k}")] for k, t in opts]))


@router.callback_query(F.data.startswith("pick:"))
async def pick_answer(c: CallbackQuery, state: FSMContext):
    _, i, k = c.data.split(":")
    i = int(i)
    data = await state.get_data()
    ans = (data.get("pick") or [])[:i] + [k]
    await state.update_data(pick=ans)
    await c.answer()
    try:
        await c.message.edit_reply_markup(reply_markup=None)
    except Exception:
        pass
    if i < 2:
        await ask_pick(c.message, i + 1)
        return
    await state.clear()
    what, has, how = ans
    name, price, why = T.PICK_RESULT[what][how]
    text = (f"<b>Вам подойдёт: {name}</b>\nЦена: {price}\n\n{why}\n{T.PICK_HAS[has]}\n\n"
            "Точный объём и срок назовём после короткой заявки.")
    await c.message.answer(text, reply_markup=ikb([[("📝 Оставить заявку на это", f"lead:start:{what}")],
                                                   [("🖼 Посмотреть кейсы", "cases"), ("🤔 Есть сомнение", "doubts")]]))


# ---------- цены ----------
@router.message(F.text == T.BTN["prices"])
async def prices(m: Message, state: FSMContext):
    await state.clear()
    rows = [[(v[0], f"price:{k}")] for k, v in T.PRICES.items()]
    if KP_FILE.exists():
        rows.append([("📄 Всё в одном PDF (КП)", "kp")])
    await m.answer("💰 <b>Цены</b>\n\nВыберите направление:", reply_markup=ikb(rows))


@router.callback_query(F.data.startswith("price:"))
async def price_one(c: CallbackQuery):
    k = c.data.split(":")[1]
    title, body = T.PRICES[k]
    await c.answer()
    await c.message.answer(f"<b>{title}</b>\n\n{body}{T.PRICES_FOOT}",
                           reply_markup=ikb([[("📝 Оставить заявку", f"lead:start:{k}")],
                                             [("🤔 Дорого?", "doubt:price"), ("💰 Другие цены", "prices")]]))


@router.callback_query(F.data == "prices")
async def prices_cb(c: CallbackQuery, state: FSMContext):
    await c.answer()
    await prices(c.message, state)


@router.callback_query(F.data == "kp")
async def kp(c: CallbackQuery):
    await c.answer()
    if KP_FILE.exists():
        await c.message.answer_document(FSInputFile(KP_FILE, filename="IMER — коммерческое предложение.pdf"),
                                        caption="Коммерческое предложение IMER: услуги, цены, кейсы и процесс.")
    else:
        await c.message.answer("Файл КП пока не загружен — пришлём его лично.")


# ---------- кейсы ----------
@router.message(F.text == T.BTN["cases"])
async def cases(m: Message, state: FSMContext):
    await state.clear()
    rows = [[(c[1], f"case:{c[0]}")] for c in T.CASES]
    if SITE_URL:
        rows.append([("🌐 Все кейсы на сайте", site("cases.html"))])
    await m.answer("🖼 <b>Кейсы</b>\n\nВыберите проект:", reply_markup=ikb(rows))


@router.callback_query(F.data == "cases")
async def cases_cb(c: CallbackQuery, state: FSMContext):
    await c.answer()
    await cases(c.message, state)


@router.callback_query(F.data.startswith("case:"))
async def case_one(c: CallbackQuery):
    k = c.data.split(":")[1]
    item = next(x for x in T.CASES if x[0] == k)
    await c.answer()
    url = item[4] if len(item) > 4 else ""
    rows = [[("👀 Смотреть полный кейс", url)]] if url else []
    rows += [[("📝 Хочу так же", "lead:start")], [("🖼 Другие кейсы", "cases")]]
    title = item[1].split(" ", 1)[1] if not item[1][0].isalnum() else item[1]
    await send_img(c.message, item[2], f"<b>{title}</b>\n\n{item[3]}", ikb(rows))


# ---------- сомнения ----------
@router.message(F.text == T.BTN["doubts"])
async def doubts(m: Message, state: FSMContext):
    await state.clear()
    rows = [[(d[1], f"doubt:{d[0]}")] for d in T.DOUBTS]
    await m.answer(T.DOUBTS_INTRO, reply_markup=ikb(rows))


@router.callback_query(F.data == "doubts")
async def doubts_cb(c: CallbackQuery, state: FSMContext):
    await c.answer()
    await doubts(c.message, state)


async def answer_doubt(m: Message, d):
    extra = None
    if d[0] in ("think", "agency") and KP_FILE.exists():
        extra = [[("📄 Прислать КП в PDF", "kp")]]
    if d[0] in ("fear", "agency", "burned"):
        extra = (extra or []) + [[("🖼 Посмотреть кейсы", "cases")]]
    if d[0] in ("roi", "price") and SITE_URL:
        extra = (extra or []) + [[("🧮 Калькулятор на сайте", site("index.html#calc"))]]
    await m.answer(d[2], reply_markup=cta_rows(extra))


@router.callback_query(F.data.startswith("doubt:"))
async def doubt_one(c: CallbackQuery):
    k = c.data.split(":")[1]
    d = next(x for x in T.DOUBTS if x[0] == k)
    await c.answer()
    await answer_doubt(c.message, d)


def match_doubt(text: str):
    t = text.lower()
    best, score = None, 0
    for d in T.DOUBTS:
        s = sum(1 for w in d[3] if w in t)
        if s > score:
            best, score = d, s
    return best


# ---------- заявка ----------
class Lead(StatesGroup):
    dirs = State()
    task = State()
    when = State()
    budget = State()
    contact = State()


def dirs_kb(sel):
    rows = [[(("✅ " if k in sel else "") + t, f"ld:{k}")] for k, t in T.LEAD_DIRS]
    rows.append([("Дальше →", "ld:next")])
    return ikb(rows)


@router.message(F.text == T.BTN["lead"])
async def lead_start(m: Message, state: FSMContext, preset=None):
    await state.clear()
    await state.set_state(Lead.dirs)
    sel = [preset] if preset else []
    await state.update_data(dirs=sel)
    await m.answer(T.LEAD_START, reply_markup=dirs_kb(sel))


@router.callback_query(F.data.startswith("lead:start"))
async def lead_start_cb(c: CallbackQuery, state: FSMContext):
    await c.answer()
    parts = c.data.split(":")
    await lead_start(c.message, state, preset=parts[2] if len(parts) > 2 else None)


@router.callback_query(Lead.dirs, F.data.startswith("ld:"))
async def lead_dirs(c: CallbackQuery, state: FSMContext):
    k = c.data.split(":")[1]
    data = await state.get_data()
    sel = data.get("dirs", [])
    if k == "next":
        if not sel:
            await c.answer("Выберите хотя бы одно направление", show_alert=True)
            return
        await c.answer()
        await c.message.edit_reply_markup(reply_markup=None)
        await state.set_state(Lead.task)
        await c.message.answer(T.LEAD_TASK, reply_markup=ikb([[("Пропустить, расскажу на созвоне", "lt:skip")]]))
        return
    sel = [x for x in sel if x != k] if k in sel else sel + [k]
    await state.update_data(dirs=sel)
    await c.answer()
    await c.message.edit_reply_markup(reply_markup=dirs_kb(sel))


@router.callback_query(Lead.task, F.data == "lt:skip")
async def lead_task_skip(c: CallbackQuery, state: FSMContext):
    await c.answer()
    await state.update_data(task="—", task_msgs=[])
    await ask_when(c.message, state)


@router.message(Lead.task, NOT_MENU)
async def lead_task(m: Message, state: FSMContext):
    data = await state.get_data()
    msgs = data.get("task_msgs", []) + [[m.chat.id, m.message_id]]
    txt = m.text or m.caption or ("🎤 голосовое" if m.voice or m.video_note else "📎 вложение")
    await state.update_data(task=txt, task_msgs=msgs)
    await ask_when(m, state)


async def ask_when(m: Message, state: FSMContext):
    await state.set_state(Lead.when)
    await m.answer(T.LEAD_WHEN_Q + "\n\n<b>Срок:</b>", reply_markup=ikb([[(t, f"lw:{i}")] for i, t in enumerate(T.LEAD_WHEN)]))


@router.callback_query(Lead.when, F.data.startswith("lw:"))
async def lead_when(c: CallbackQuery, state: FSMContext):
    await c.answer()
    await state.update_data(when=T.LEAD_WHEN[int(c.data.split(":")[1])])
    await c.message.edit_reply_markup(reply_markup=None)
    await state.set_state(Lead.budget)
    await c.message.answer("<b>Бюджет:</b>\nНужен, чтобы предложить подходящий пакет, а не самый дорогой.",
                           reply_markup=ikb([[(t, f"lb:{i}")] for i, t in enumerate(T.LEAD_BUDGET)]))


@router.callback_query(Lead.budget, F.data.startswith("lb:"))
async def lead_budget(c: CallbackQuery, state: FSMContext):
    await c.answer()
    await state.update_data(budget=T.LEAD_BUDGET[int(c.data.split(":")[1])])
    await c.message.edit_reply_markup(reply_markup=None)
    await state.set_state(Lead.contact)
    kb = ReplyKeyboardMarkup(keyboard=[[KeyboardButton(text="📱 Поделиться номером", request_contact=True)],
                                       [KeyboardButton(text="Пишите сюда, в Telegram")]],
                             resize_keyboard=True, one_time_keyboard=True)
    await c.message.answer(T.LEAD_CONTACT + "\n\n<i>" + T.LEAD_CONSENT + "</i>", reply_markup=kb)


@router.message(Lead.contact, NOT_MENU)
async def lead_contact(m: Message, state: FSMContext):
    u = m.from_user
    if m.contact:
        contact = m.contact.phone_number
    elif m.text and "сюда" in m.text.lower():
        contact = f"@{u.username}" if u.username else f"Telegram ID {u.id}"
    else:
        contact = (m.text or "").strip()
        if len(contact) < 3:
            await m.answer("Оставьте телефон или нажмите «Пишите сюда, в Telegram».")
            return
    data = await state.get_data()
    await state.clear()
    names = dict(T.LEAD_DIRS)
    dirs = ", ".join(names.get(x, x) for x in data.get("dirs", []))
    store.d["leads"] += 1
    store.save()
    report = (f"📝 <b>Новая заявка из бота №{store.d['leads']}</b>\n\n"
              f"<b>Кто:</b> {who(u)}\n<b>Контакт:</b> {html.escape(contact)}\n<b>Направления:</b> {html.escape(dirs)}\n"
              f"<b>Задача:</b> {html.escape(str(data.get('task', '—')))[:3000]}\n<b>Срок:</b> {html.escape(str(data.get('when', '—')))}\n"
              f"<b>Бюджет:</b> {html.escape(str(data.get('budget', '—')))}\n\n"
              "Ответьте на это сообщение (reply) — ответ уйдёт клиенту." + id_tag(u))
    bot = m.bot
    for a in ADMIN_IDS:
        try:
            await bot.send_message(a, report)
            for chat_id, mid in data.get("task_msgs", []):
                await bot.forward_message(a, chat_id, mid)
        except Exception as e:
            log.error("Заявка не дошла до админа %s: %s", a, e)
    await post_sheet({"date": datetime.now().strftime("%d.%m.%Y, %H:%M:%S"), "name": u.full_name,
                      "contact": contact, "method": "Telegram-бот", "dir": dirs,
                      "desc": f"ЗАЯВКА ИЗ TELEGRAM-БОТА\n— Задача: {data.get('task', '—')}\n— Пользователь: {who(u, plain=True)}",
                      "links": "", "when": data.get("when", ""), "budget": data.get("budget", ""), "page": "telegram-бот"})
    await m.answer(T.LEAD_DONE, reply_markup=main_kb())


# ---------- вопрос человеку ----------
class Ask(StatesGroup):
    text = State()


@router.message(F.text == T.BTN["ask"])
async def ask(m: Message, state: FSMContext):
    await state.clear()
    await state.set_state(Ask.text)
    await m.answer(T.ASK_PROMPT)


@router.callback_query(F.data == "ask")
async def ask_cb(c: CallbackQuery, state: FSMContext):
    await c.answer()
    await ask(c.message, state)


@router.message(Ask.text, NOT_MENU)
async def ask_text(m: Message, state: FSMContext):
    await state.clear()
    await notify_admins(m.bot, f"💬 <b>Вопрос от клиента</b>\n{who(m.from_user)}\n\n"
                               "Ответьте на это сообщение (reply) — ответ уйдёт клиенту." + id_tag(m.from_user), copy_from=m)
    await m.answer(T.ASK_DONE, reply_markup=main_kb())


# ---------- ответ админа клиенту ----------
@router.message(F.reply_to_message, F.from_user.id.in_(set(ADMIN_IDS) or {0}))
async def admin_reply(m: Message):
    r = m.reply_to_message
    uid = None
    origin = getattr(r, "forward_origin", None)
    sender = getattr(origin, "sender_user", None) or getattr(r, "forward_from", None)
    if sender:
        uid = sender.id
    else:
        # только служебная метка в самом конце карточки (см. id_tag);
        # «ID: …» в тексте не используем: имя и контакт клиент пишет сам
        found = re.search(r"🆔 (\d+)\s*$", r.text or r.caption or "")
        if found:
            uid = int(found.group(1))
    if not uid:
        await m.answer("Не вижу, кому отвечать. Ответьте на сообщение бота с заявкой или вопросом "
                       "(внизу у неё есть метка 🆔). Если клиент скрыл профиль при пересылке — отвечайте на карточку заявки.")
        return
    try:
        await m.copy_to(uid)
        await m.answer("✅ Отправлено клиенту.")
    except Exception as e:
        await m.answer(f"Не получилось отправить: {html.escape(str(e))}")


# ---------- обучение ----------
class Learn(StatesGroup):
    q = State()


@router.message(F.text == T.BTN["learn"])
async def learn(m: Message, state: FSMContext):
    await state.clear()
    rows = [[("🧭 Подобрать программу за 3 вопроса", "learn:test")],
            [("🎯 Квест для дизайнеров + гайд в подарок", "quest:0")]]
    if SITE_URL:
        rows.append([("🌐 Программы и цены на сайте", site("learn.html"))])
    await m.answer(T.LEARN_INTRO, reply_markup=ikb(rows))


@router.callback_query(F.data == "learn:test")
async def learn_test(c: CallbackQuery, state: FSMContext):
    await c.answer()
    await state.set_state(Learn.q)
    await state.update_data(learn=[])
    await ask_learn(c.message, 0)


async def ask_learn(m: Message, i: int):
    q, opts = T.LEARN_Q[i]
    await m.answer(f"<b>({i + 1}/3) {q}</b>", reply_markup=ikb([[(t, f"lq:{i}:{k}")] for k, t in opts]))


@router.callback_query(F.data.startswith("lq:"))
async def learn_answer(c: CallbackQuery, state: FSMContext):
    _, i, k = c.data.split(":")
    i = int(i)
    data = await state.get_data()
    ans = (data.get("learn") or [])[:i] + [k]
    await state.update_data(learn=ans)
    await c.answer()
    try:
        await c.message.edit_reply_markup(reply_markup=None)
    except Exception:
        pass
    if i < 2:
        await ask_learn(c.message, i + 1)
        return
    await state.clear()
    what, exp, fmt = ans
    direction, spec, price = T.LEARN_RESULT[what]
    if exp == "pro":
        price, note = "отдельные модули — от 9 900 ₽", "База у вас есть: возьмите недостающие модули или интенсив — от 24 900 ₽ в месяц."
    elif exp == "zero":
        note = "Начнём с основ: первые модули каждой специализации — про базу."
    else:
        note = "Пропустим то, что вы уже знаете, и сфокусируемся на практике и портфолио."
    await c.message.answer(f"<b>Вам подойдёт: {direction}, {spec}</b>\n{T.LEARN_FORMAT[fmt]}, {price}\n\n{note}",
                           reply_markup=ikb([[("📝 Записаться на консультацию", "lead:start:learn")],
                                             [("🎯 Пройти квест", "quest:0")]]))


# ---------- квест ----------
def quest_get(uid):
    return store.d["quest"].setdefault(str(uid), {"step": 0, "score": 0})


@router.callback_query(F.data.startswith("quest:"))
async def quest(c: CallbackQuery):
    i = int(c.data.split(":")[1])
    await c.answer()
    if i == 0:
        store.d["quest"][str(c.from_user.id)] = {"step": 0, "score": 0}
        store.save()
        await c.message.answer(T.QUEST_INTRO, reply_markup=ikb([[("Начать →", "quest:1")]]))
        return
    title, q, wrong, right, _, _ = T.QUEST[i - 1]
    opts = [(right, f"qa:{i}:1"), (wrong, f"qa:{i}:0")]
    if i % 2:
        opts.reverse()
    await c.message.answer(f"<b>Задание {i}/9: {title}</b>\n\n{q}", reply_markup=ikb([[o] for o in opts]))


@router.callback_query(F.data.startswith("qa:"))
async def quest_answer(c: CallbackQuery):
    _, i, ok = c.data.split(":")
    i, ok = int(i), ok == "1"
    p = quest_get(c.from_user.id)
    await c.answer()
    try:
        await c.message.edit_reply_markup(reply_markup=None)
    except Exception:
        pass
    if p["step"] < i:
        p["step"] = i
        p["score"] += 1 if ok else 0
        store.save()
    _, _, _, _, good, bad = T.QUEST[i - 1]
    head = "✅ <b>Верно!</b> " + good if ok else "❌ <b>Не совсем.</b> " + bad
    if i < 9:
        await c.message.answer(f"{head}\n\n⭐ Баллы: {p['score']} из {i}",
                               reply_markup=ikb([[(f"Задание {i + 1} →", f"quest:{i + 1}")]]))
        return
    level = next(name for lim, name in T.QUEST_LEVELS if p["score"] >= lim)
    await c.message.answer(f"{head}\n\n🎉 <b>Квест пройден!</b>\nРезультат: {p['score']} из 9 — {level}.")
    if GUIDE_FILE.exists():
        await c.message.answer_document(FSInputFile(GUIDE_FILE, filename="IMER — Карточка за 3 секунды.pdf"),
                                        caption=T.QUEST_GIFT)
    await c.message.answer("Хотите научиться делать такое на заказ?",
                           reply_markup=ikb([[("🎓 Подобрать программу", "learn:test")],
                                             [("📝 Записаться на консультацию", "lead:start:learn")]]))


# ---------- полезное ----------
@router.message(F.text == T.BTN["useful"])
async def useful(m: Message, state: FSMContext):
    await state.clear()
    rows = [[(t, f"use:{k}")] for k, t, _ in T.USEFUL]
    rows.append([("🎯 Квест для дизайнеров + гайд", "quest:0")])
    await m.answer("🎁 <b>Полезное</b>\n\nВыберите тему:", reply_markup=ikb(rows))


@router.callback_query(F.data.startswith("use:"))
async def useful_one(c: CallbackQuery):
    k = c.data.split(":")[1]
    item = next(x for x in T.USEFUL if x[0] == k)
    await c.answer()
    await c.message.answer(item[2], reply_markup=ikb([[("🎁 Другие темы", "useful")]]))


@router.callback_query(F.data == "useful")
async def useful_cb(c: CallbackQuery, state: FSMContext):
    await c.answer()
    await useful(c.message, state)


# ---------- всё остальное: распознаём сомнение или передаём человеку ----------
@router.message(StateFilter(None))
async def fallback(m: Message, state: FSMContext):
    store.seen(m.from_user)
    text = m.text or m.caption or ""
    low = text.lower()
    if any(w in low for w in ("сколько стоит", "цена", "цены", "прайс", "стоимост")) and "дорог" not in low:
        await prices(m, state)
        return
    d = match_doubt(text) if text else None
    if d:
        await answer_doubt(m, d)
        return
    await notify_admins(m.bot, f"💬 <b>Сообщение от клиента</b>\n{who(m.from_user)}\n\n"
                               "Ответьте на это сообщение (reply) — ответ уйдёт клиенту." + id_tag(m.from_user), copy_from=m)
    await m.answer(T.FALLBACK_FORWARDED, reply_markup=main_kb())


# ---------- запуск ----------
async def setup_profile(bot: Bot):
    try:
        await bot.set_my_commands([
            BotCommand(command="start", description="Главное меню"),
            BotCommand(command="menu", description="Показать кнопки"),
            BotCommand(command="contacts", description="Контакты IMER"),
        ])
        await bot.set_my_description(description=T.BOT_DESCRIPTION)
        await bot.set_my_short_description(short_description=T.BOT_SHORT)
    except Exception as e:
        log.warning("Профиль бота не обновился: %s", e)


async def main():
    bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode="HTML"))
    dp = Dispatcher(storage=MemoryStorage())
    dp.include_router(router)
    me = await bot.get_me()
    await setup_profile(bot)
    log.info("Бот @%s запущен. Админы: %s. Картинки: %s", me.username, ADMIN_IDS, IMG_DIR)
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)


def single_instance():
    """Не даём запустить второго бота с тем же токеном: Telegram отдаёт обновления только
    одному, и два бота мешали бы друг другу (ошибка Conflict)."""
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(("127.0.0.1", 47613))
    except OSError:
        log.warning("Бот уже запущен (автозапуск или другое окно). Этот экземпляр закрывается.")
        sys.exit(0)
    return s


if __name__ == "__main__":
    _lock = single_instance()
    while True:
        try:
            asyncio.run(main())
        except KeyboardInterrupt:
            log.info("Бот остановлен.")
            break
        except SystemExit:
            raise
        except Exception as e:
            log.error("Ошибка: %s. Перезапуск через 5 секунд…", e)
            import time
            time.sleep(5)
