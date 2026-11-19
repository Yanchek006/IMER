/* IMER — умный бриф.
   Клиент выбирает направления и видит только вопросы по ним.
   Почти всё — нажатиями, любой вопрос можно пропустить, ответы сохраняются в браузере.
   На выходе — заявка с готовой сводкой по пунктам (уходит в таблицу через LEADS_URL из app.js). */
(() => {
  const root = document.getElementById('brief2');
  if (!root) return;
  const $ = (s, r = document) => r.querySelector(s);
  const NB = ' ';
  const typo = (v) => String(v)
    .replace(/(^|[\s(«"])(в|во|с|со|к|ко|о|об|у|и|а|но|на|по|за|из|от|до|не|для|без|под|над|про|при|или|как|что) +(?=\S)/gi, `$1$2${NB}`)
    .replace(/ +(—|–) /g, `${NB}$1 `)
    .replace(/(\d) (?=\d{3}\b|₽|%)/g, `$1${NB}`);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const DK = 'Не знаю, подскажите';

  /* ---------- вопросы ---------- */
  const DIRS = [
    { id: 'site', title: 'Сайт или лендинг', hint: 'новый сайт, редизайн, магазин', qs: [
      { id: 'type', q: 'Какой сайт нужен?', one: ['Лендинг (одна страница)', 'Сайт-визитка', 'Корпоративный сайт', 'Интернет-магазин', 'Редизайн текущего', DK] },
      { id: 'platform', q: 'На чём делаем?', note: 'Tilda — быстрее и правите сами. Код — без ограничений шаблона.', one: ['Tilda, хочу править сам(а)', 'На коде, нужна свобода', DK] },
      { id: 'goal', q: 'Что сайт должен делать?', many: ['Приводить заявки', 'Продавать онлайн', 'Записывать на услуги', 'Вызывать доверие', 'Запустить новый продукт'] },
      { id: 'sections', q: 'Какие разделы точно нужны?', many: ['О компании', 'Услуги или каталог', 'Портфолио, кейсы', 'Отзывы', 'Цены', 'Блог', 'Онлайн-оплата', 'Личный кабинет'] },
      { id: 'content', q: 'Тексты и фото', one: ['Всё готово', 'Есть частично', 'Нужно сделать с нуля'] },
      { id: 'url', q: 'Ссылка на текущий сайт', text: 'https://… (если есть)' },
    ] },
    { id: 'info', title: 'Инфографика WB / Ozon', hint: 'обложки и слайды карточек', qs: [
      { id: 'market', q: 'Где продаёте?', many: ['Wildberries', 'Ozon', 'Яндекс Маркет', 'Другая площадка'] },
      { id: 'product', q: 'Что за товар?', text: 'Например: беспроводные наушники' },
      { id: 'count', q: 'Сколько товаров?', one: ['1', '2–5', '6–20', 'Больше 20'] },
      { id: 'slides', q: 'Сколько слайдов на товар?', note: 'Обложка — первое, что видит покупатель. Остальные слайды раскрывают выгоды.', one: ['Только обложка', '3–5 слайдов', '6–10 слайдов', DK] },
      { id: 'photo', q: 'Фото товара', one: ['Есть студийные', 'Есть свои, любительские', 'Фото нет'] },
      { id: 'extra', q: 'Нужно ещё что-то?', many: ['Rich-контент', 'Ресайз под другую площадку', 'Техническое задание'] },
      { id: 'url', q: 'Ссылка на товар или конкурента', text: 'https://…' },
    ] },
    { id: 'brand', title: 'Брендинг и полиграфия', hint: 'логотип, стиль, визитки', qs: [
      { id: 'need', q: 'Что нужно?', many: ['Логотип', 'Фирменный стиль', 'Визитки', 'Листовки, флаеры', 'Афиши, баннеры', 'Упаковка, этикетки', 'Оформление соцсетей'] },
      { id: 'logo', q: 'Логотип сейчас', one: ['Нет, делаем с нуля', 'Есть, нужно обновить', 'Есть, оставляем'] },
      { id: 'name', q: 'Название бизнеса', text: 'Как называется' },
      { id: 'mood', q: 'Каким должен быть стиль?', note: 'Выберите до трёх.', many: ['Строгий', 'Премиальный', 'Дружелюбный', 'Смелый, яркий', 'Минималистичный', 'Природный, тёплый'], max: 3 },
      { id: 'print', q: 'Нужна печать?', one: ['Да, подготовить к печати', 'Только онлайн', DK] },
    ] },
    { id: 'deck', title: 'Презентация', hint: 'продажи, питч, выступление', qs: [
      { id: 'goal', q: 'Для чего презентация?', one: ['Продажи клиенту', 'Питч инвестору', 'Выступление', 'Отчёт', 'Другое'] },
      { id: 'slides', q: 'Сколько слайдов?', one: ['До 10', '10–20', 'Больше 20', DK] },
      { id: 'content', q: 'Текст и структура', one: ['Готовы, нужен дизайн', 'Есть наброски', 'Нужно с нуля'] },
      { id: 'format', q: 'В каком формате?', many: ['PDF', 'PowerPoint', 'Google Slides', 'Keynote'] },
      { id: 'extra', q: 'Что добавить?', many: ['Инфографика и схемы', 'Анимация', 'Иконки и иллюстрации'] },
    ] },
    { id: 'dev', title: 'Разработка, приложение', hint: 'веб-сервис, мобильное, интеграции', qs: [
      { id: 'what', q: 'Что разрабатываем?', many: ['Веб-сервис или личный кабинет', 'Мобильное приложение', 'Интеграции: CRM, оплата, 1С', 'Чат-бот', 'Доработка того, что есть'] },
      { id: 'platforms', q: 'Платформы', many: ['Web', 'iOS', 'Android'] },
      { id: 'stage', q: 'На каком этапе проект?', one: ['Только идея', 'Есть ТЗ', 'Есть дизайн или прототип', 'Продукт работает, нужно развивать'] },
      { id: 'design', q: 'Дизайн', one: ['Уже есть', 'Нужен и дизайн тоже', DK] },
      { id: 'integr', q: 'С чем связать?', many: ['CRM', 'Онлайн-оплата', '1С', 'Telegram', 'Авторизация', DK] },
    ] },
    { id: 'ai', title: 'AI-агенты, автоматизация', hint: 'убрать рутину', qs: [
      { id: 'routine', q: 'Какую рутину хотите отдать?', many: ['Ответы клиентам', 'Обработка заявок', 'Тексты и описания товаров', 'Отчёты и сводки', 'Генерация визуала'] },
      { id: 'where', q: 'Где это происходит сейчас?', many: ['Telegram', 'WhatsApp', 'Таблицы', 'CRM', 'Сайт', 'Почта'] },
      { id: 'hours', q: 'Сколько времени уходит на это?', one: ['Пара часов в неделю', '5–10 часов в неделю', 'Больше 10 часов', 'Не считал(а)'] },
    ] },
    { id: 'learn', title: 'Обучение', hint: 'дизайн или разработка с нуля', qs: [
      { id: 'dir', q: 'Чему хотите научиться?', one: ['Дизайну', 'Разработке', 'Дизайну и разработке', DK] },
      { id: 'exp', q: 'Ваш опыт', one: ['Нет опыта', 'Немного, учусь сам(а)', 'Уже работаю в профессии'] },
      { id: 'format', q: 'Как удобнее учиться?', one: ['Сам(а), в своём темпе', 'В группе с куратором', 'С личным наставником'] },
    ] },
    { id: 'unsure', title: 'Пока не знаю', hint: 'подскажем на консультации', qs: [
      { id: 'want', q: 'Что хотите получить в итоге?', note: 'Пары слов достаточно — остальное уточним на созвоне.', area: 'Например: больше заказов из интернета' },
    ] },
  ];
  const ABOUT = { id: 'about', title: 'О бизнесе', qs: [
    { id: 'niche', q: 'Чем занимаетесь?', text: 'Например: студия маникюра в Москве' },
    { id: 'clients', q: 'Кто ваши клиенты?', one: ['Частные люди', 'Компании', 'И те, и другие'] },
    { id: 'goal', q: 'Главная цель', many: ['Больше заявок и продаж', 'Выделиться среди конкурентов', 'Запустить новое', 'Обновить устаревшее', 'Сэкономить время'] },
    { id: 'refs', q: 'Примеры, которые нравятся', note: 'Сайты, карточки, бренды — что угодно. Это экономит часы объяснений.', text: 'Ссылки через запятую' },
    { id: 'comment', q: 'Что ещё важно знать?', area: 'Необязательно. Если удобнее голосом — пришлите в Telegram @imerbot_bot' },
  ] };
  const PLAN = { id: 'plan', title: 'Сроки и бюджет', qs: [
    { id: 'when', q: 'Когда нужен результат?', one: ['Срочно, до 2 недель', 'В течение месяца', 'За 2–3 месяца', 'Не горит, важнее качество'] },
    { id: 'budget', q: 'Бюджет', note: 'Нужен, чтобы предложить подходящий пакет, а не самый дорогой.', one: ['До 25 000 ₽', '25 000 – 50 000 ₽', '50 000 – 100 000 ₽', 'Больше 100 000 ₽', DK] },
    { id: 'decide', q: 'Кто принимает решение?', one: ['Я сам(а)', 'Вместе с партнёром', 'Согласование в компании'] },
  ] };

  /* ---------- состояние ---------- */
  const KEY = 'imer-brief-v2';
  let st = { dirs: [], has: '', a: {}, name: '', contact: '', method: 'Telegram', time: '', consent: false, step: 0, quick: false };
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.a) st = Object.assign(st, s, { step: s.step || 0 }); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };

  const steps = () => {
    if (st.quick) return ['start', 'contacts', 'review'];
    const d = DIRS.filter((x) => st.dirs.includes(x.id)).map((x) => 'dir:' + x.id);
    return ['start', 'need', ...d, 'about', 'plan', 'contacts', 'review'];
  };
  const stepTitle = (k) => k === 'start' ? 'Начало' : k === 'need' ? 'Что нужно' : k === 'about' ? 'О бизнесе' : k === 'plan' ? 'Сроки и бюджет'
    : k === 'contacts' ? 'Контакты' : k === 'review' ? 'Проверка' : DIRS.find((x) => 'dir:' + x.id === k).title;

  const val = (sec, q) => (st.a[sec] || {})[q];
  const setVal = (sec, q, v) => { st.a[sec] = st.a[sec] || {}; st.a[sec][q] = v; save(); };

  /* ---------- отрисовка вопроса ---------- */
  const qHTML = (sec, q) => {
    const v = val(sec, q.id);
    const nm = `${sec}__${q.id}`;
    let body = '';
    if (q.one || q.many) {
      const list = q.one || q.many;
      body = `<div class="chips" role="group" aria-label="${esc(q.q)}">` + list.map((o, i) => {
        const on = q.one ? v === o : Array.isArray(v) && v.includes(o);
        return `<label class="chip2"><input type="${q.one ? 'radio' : 'checkbox'}" name="${nm}" value="${esc(o)}" data-sec="${sec}" data-q="${q.id}" ${q.max ? `data-max="${q.max}"` : ''} ${on ? 'checked' : ''}><span>${esc(typo(o))}</span></label>`;
      }).join('') + '</div>';
    } else if (q.area) {
      body = `<textarea class="tx" data-sec="${sec}" data-q="${q.id}" rows="3" placeholder="${esc(q.area)}">${esc(v || '')}</textarea>`;
    } else {
      body = `<input class="tx" type="text" data-sec="${sec}" data-q="${q.id}" placeholder="${esc(q.text)}" value="${esc(v || '')}">`;
    }
    return `<div class="q2"><p class="q2-t">${esc(typo(q.q))}${q.many ? ' <span class="mono muted">можно несколько</span>' : ''}</p>${q.note ? `<p class="q2-n">${esc(typo(q.note))}</p>` : ''}${body}</div>`;
  };

  /* ---------- сводка для исполнителя ---------- */
  const fmtV = (v) => Array.isArray(v) ? v.join(', ') : v;
  const summary = () => {
    const out = [];
    const block = (title, sec, qs) => {
      const rows = qs.map((q) => { const v = val(sec, q.id); return v && (!Array.isArray(v) || v.length) ? `— ${q.q.replace(/\?$/, '')}: ${fmtV(v)}` : null; }).filter(Boolean);
      if (rows.length) out.push(title.toUpperCase() + '\n' + rows.join('\n'));
    };
    if (st.quick) out.push('КОРОТКАЯ ЗАЯВКА: клиент просит созвониться, бриф не заполнял.');
    if (st.has) out.push('СЕЙЧАС: ' + st.has);
    DIRS.filter((d) => st.dirs.includes(d.id)).forEach((d) => block(d.title, d.id, d.qs));
    block(ABOUT.title, ABOUT.id, ABOUT.qs);
    block(PLAN.title, PLAN.id, PLAN.qs);
    if (st.time) out.push('УДОБНОЕ ВРЕМЯ ДЛЯ СВЯЗИ: ' + st.time);
    return out.join('\n\n');
  };
  const links = () => {
    const l = [];
    DIRS.forEach((d) => { const u = val(d.id, 'url'); if (u && st.dirs.includes(d.id)) l.push(u); });
    const r = val('about', 'refs'); if (r) l.push(r);
    return l.join(', ');
  };

  /* ---------- экраны ---------- */
  const body = $('#b2-body'), nav = $('#b2-nav'), bar = $('#b2-bar'), cnt = $('#b2-count');
  const btnBack = $('#b2-back'), btnNext = $('#b2-next');
  let err = '';

  const screen = (k) => {
    if (k === 'start') return `
      <h2 class="h-m">Бриф за&nbsp;3–5 минут</h2>
      <ul class="b2-list">
        <li>Почти всё&nbsp;— нажатиями, писать почти ничего не&nbsp;нужно.</li>
        <li>Вопросы только по&nbsp;вашей задаче. Любой можно пропустить.</li>
        <li>Не&nbsp;знаете ответ&nbsp;— выберите «${DK}», это нормально.</li>
        <li>Ответы сохраняются: можно закрыть и&nbsp;вернуться.</li>
      </ul>
      <div class="b2-alt">
        <p class="mono muted">нет времени на&nbsp;бриф?</p>
        <div class="row">
          <button type="button" class="btn" data-quick>Просто перезвоните мне</button>
          <a class="btn" href="https://t.me/imerbot_bot" target="_blank" rel="noopener">Рассказать голосом в&nbsp;Telegram</a>
        </div>
      </div>`;
    if (k === 'need') return `
      <h2 class="h-m">Что&nbsp;нужно сделать?</h2>
      <p class="q2-n">Можно выбрать несколько&nbsp;— зададим вопросы только по&nbsp;ним.</p>
      <div class="dirs2">${DIRS.map((d) => `<label class="dir2"><input type="checkbox" name="dir2" value="${d.id}" ${st.dirs.includes(d.id) ? 'checked' : ''}><span><b>${esc(typo(d.title))}</b><small>${esc(d.hint)}</small></span></label>`).join('')}</div>
      <div class="q2"><p class="q2-t">Что у&nbsp;вас уже есть?</p><div class="chips">${['Ничего, начинаем с нуля', 'Есть, но не работает', 'Есть основа, нужно доработать'].map((o) => `<label class="chip2"><input type="radio" name="has" value="${esc(o)}" ${st.has === o ? 'checked' : ''}><span>${esc(typo(o))}</span></label>`).join('')}</div></div>`;
    if (k.startsWith('dir:')) { const d = DIRS.find((x) => 'dir:' + x.id === k); return `<h2 class="h-m">${esc(typo(d.title))}</h2>` + d.qs.map((q) => qHTML(d.id, q)).join(''); }
    if (k === 'about') return `<h2 class="h-m">Пара слов о&nbsp;бизнесе</h2>` + ABOUT.qs.map((q) => qHTML('about', q)).join('');
    if (k === 'plan') return `<h2 class="h-m">Сроки и&nbsp;бюджет</h2>` + PLAN.qs.map((q) => qHTML('plan', q)).join('');
    if (k === 'contacts') return `
      <h2 class="h-m">${st.quick ? 'Оставьте контакт&nbsp;— перезвоним' : 'Как&nbsp;с&nbsp;вами связаться?'}</h2>
      <div class="b2-two">
        <div class="inp"><label for="b2-name">Имя</label><input id="b2-name" type="text" autocomplete="name" value="${esc(st.name)}"></div>
        <div class="inp"><label for="b2-contact">Телефон или&nbsp;Telegram</label><input id="b2-contact" type="text" autocomplete="tel" placeholder="+7… или @username" value="${esc(st.contact)}"></div>
      </div>
      <div class="q2"><p class="q2-t">Как удобнее связаться?</p><div class="chips">${['Telegram', 'WhatsApp', 'Звонок', 'E-mail'].map((o) => `<label class="chip2"><input type="radio" name="method2" value="${o}" ${st.method === o ? 'checked' : ''}><span>${o}</span></label>`).join('')}</div></div>
      <div class="q2"><p class="q2-t">Когда удобно?</p><div class="chips">${['Утром', 'Днём', 'Вечером', 'В любое время'].map((o) => `<label class="chip2"><input type="radio" name="time2" value="${o}" ${st.time === o ? 'checked' : ''}><span>${o}</span></label>`).join('')}</div></div>
      <label class="b2-consent"><input type="checkbox" id="b2-consent" ${st.consent ? 'checked' : ''}><span>Согласен(на) на&nbsp;<a class="link-u red" href="consent.html">обработку персональных данных</a> и&nbsp;принимаю <a class="link-u red" href="privacy.html">политику конфиденциальности</a></span></label>`;
    if (k === 'review') {
      const s = summary();
      return `<h2 class="h-m">Проверьте ответы</h2>
        <p class="q2-n">Всё верно? Если нет&nbsp;— нажмите на&nbsp;шаг слева или&nbsp;«Назад».</p>
        <div class="b2-sum"><p><b>${esc(st.name)}</b>, ${esc(st.contact)}, ${esc(st.method)}</p>${s ? `<pre>${esc(s)}</pre>` : '<p class="muted">Без деталей&nbsp;— уточним на&nbsp;созвоне.</p>'}</div>`;
    }
    return '';
  };

  /* смена шага: короткий сдвиг с размытием по направлению (вперёд — справа, назад — слева) */
  let shown = -1;
  const reduceMo = matchMedia('(prefers-reduced-motion: reduce)');
  const swap = (dir) => {
    if (!body.animate || reduceMo.matches) return;
    body.animate([
      { opacity: 0, transform: `translateX(${dir * 14}px)`, filter: 'blur(3px)' },
      { opacity: 1, transform: 'none', filter: 'blur(0)' },
    ], { duration: 260, easing: 'cubic-bezier(.23,1,.32,1)' });
  };

  const render = () => {
    const S = steps();
    st.step = Math.min(st.step, S.length - 1);
    const k = S[st.step];
    body.innerHTML = screen(k) + (err ? `<p class="mono red b2-err" role="alert">${esc(err)}</p>` : '');
    if (shown !== -1 && shown !== st.step) swap(st.step > shown ? 1 : -1);
    shown = st.step;
    nav.innerHTML = S.map((s, i) => `<li class="${i === st.step ? 'on' : i < st.step ? 'done' : ''}"><button type="button" data-go="${i}" ${i > st.step ? 'disabled' : ''}><span>${String(i + 1).padStart(2, '0')}</span>${esc(stepTitle(s))}</button></li>`).join('');
    bar.style.width = Math.round(((st.step + 1) / S.length) * 100) + '%';
    cnt.textContent = `шаг ${st.step + 1} из ${S.length}`;
    btnBack.hidden = st.step === 0;
    btnNext.innerHTML = k === 'start' ? 'Начать <span aria-hidden="true">→</span>' : k === 'review' ? '<span class="dot"></span>Отправить бриф' : 'Дальше <span aria-hidden="true">→</span>';
    save();
  };

  const validate = (k) => {
    if (k === 'need' && !st.dirs.length) return 'Выберите хотя бы одно направление — или «Пока не знаю».';
    if (k === 'contacts') {
      if (!st.name.trim()) return 'Укажите имя.';
      if (st.contact.trim().length < 3) return 'Оставьте телефон или Telegram — иначе не сможем ответить.';
      if (!st.consent) return 'Нужно согласие на обработку данных.';
    }
    return '';
  };

  const send = () => {
    const DIRNAME = Object.fromEntries(DIRS.map((d) => [d.id, d.title]));
    const lead = {
      date: new Date().toLocaleString('ru-RU'),
      name: st.name.trim(), contact: st.contact.trim(), method: st.method,
      dir: st.quick ? 'Перезвонить' : st.dirs.map((d) => DIRNAME[d]).join(', '),
      desc: summary(), links: links(),
      when: val('plan', 'when') || '', budget: val('plan', 'budget') || '',
      page: 'brief',
    };
    try { if (typeof sendLead === 'function') sendLead(lead); } catch (e) {}
    window.__imerLastLead = lead;
    const txt = `Бриф IMER\n${lead.name}, ${lead.contact} (${lead.method})\nНаправления: ${lead.dir}\n\n${lead.desc}`;
    $('#b2-form').hidden = true; $('#b2-done').hidden = false;
    $('#b2-copy').onclick = () => { try { navigator.clipboard.writeText(txt); $('#b2-copy').textContent = 'Скопировано'; } catch (e) {} };
    try { localStorage.removeItem(KEY); } catch (e) {}
    window.scrollTo({ top: root.offsetTop - 100, behavior: 'smooth' });
  };

  /* ---------- события ---------- */
  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'dir2') {
      const v = t.value;
      st.dirs = t.checked ? [...st.dirs, v] : st.dirs.filter((x) => x !== v);
      if (v === 'unsure' && t.checked) st.dirs = ['unsure'];
      if (v !== 'unsure' && t.checked) st.dirs = st.dirs.filter((x) => x !== 'unsure');
      err = ''; render(); return;
    }
    if (t.name === 'has') st.has = t.value;
    else if (t.name === 'method2') st.method = t.value;
    else if (t.name === 'time2') st.time = t.value;
    else if (t.id === 'b2-consent') st.consent = t.checked;
    else if (t.dataset.sec) {
      if (t.type === 'radio') setVal(t.dataset.sec, t.dataset.q, t.value);
      else if (t.type === 'checkbox') {
        const all = Array.from(root.querySelectorAll(`input[name="${t.name}"]:checked`)).map((i) => i.value);
        const max = +t.dataset.max || 0;
        if (max && all.length > max) { t.checked = false; return; }
        let v = all;
        if (t.value === DK && t.checked) { v = [DK]; root.querySelectorAll(`input[name="${t.name}"]`).forEach((i) => { i.checked = i.value === DK; }); }
        else if (t.checked) { v = all.filter((x) => x !== DK); const dk = root.querySelector(`input[name="${t.name}"][value="${DK}"]`); if (dk) dk.checked = false; }
        setVal(t.dataset.sec, t.dataset.q, v);
      }
    }
    save();
  });
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'b2-name') st.name = t.value;
    else if (t.id === 'b2-contact') st.contact = t.value;
    else if (t.dataset.sec && (t.tagName === 'TEXTAREA' || t.type === 'text')) setVal(t.dataset.sec, t.dataset.q, t.value);
    save();
  });
  /* повторный клик по выбранному варианту снимает выбор (для одиночных вопросов) */
  root.addEventListener('click', (e) => {
    const lab = e.target.tagName !== 'INPUT' && e.target.closest('.chip2');
    if (lab) {
      const inp = lab.querySelector('input[type="radio"]');
      if (inp && inp.checked && inp.dataset.sec) { e.preventDefault(); inp.checked = false; setVal(inp.dataset.sec, inp.dataset.q, ''); return; }
    }
    const go = e.target.closest('[data-go]');
    if (go) { st.step = +go.dataset.go; err = ''; render(); return; }
    if (e.target.closest('[data-quick]')) { st.quick = true; st.step = 1; err = ''; render(); return; }
  });
  btnNext.addEventListener('click', () => {
    const S = steps(); const k = S[st.step];
    if (k === 'start') st.quick = false;
    err = validate(k);
    if (err) { render(); return; }
    if (k === 'review') { send(); return; }
    st.step += 1; render();
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  btnBack.addEventListener('click', () => {
    err = '';
    if (st.quick && st.step === 1) { st.quick = false; st.step = 0; } else st.step = Math.max(0, st.step - 1);
    render();
  });
  $('#b2-restart')?.addEventListener('click', () => {
    st = { dirs: [], has: '', a: {}, name: '', contact: '', method: 'Telegram', time: '', consent: false, step: 0, quick: false };
    $('#b2-form').hidden = false; $('#b2-done').hidden = true; render();
  });
  render();
})();
