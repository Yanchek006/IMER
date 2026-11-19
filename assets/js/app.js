/* Куда отправлять заявки из брифа: вставьте ссылку веб-приложения Google Apps Script */
const LEADS_URL = 'https://script.google.com/macros/s/AKfycbzhDZ3fH34UJk2-zI_nERXBorRVKLGdHIR5eQaeoWoHe7PpcZwGgZ7QhhPyoRKaFqQ6/exec';

/* Отправка заявки: обрезаем длину полей, ловим ботов (скрытое поле и слишком быстрое
   заполнение), не даём отправить чаще раза в минуту с одного браузера.
   Главная защита всё равно на стороне таблицы (docs/zayavki-podklyuchenie.md). */
const IMER_T0 = Date.now();
const sendLead = (lead) => {
  if (!LEADS_URL) return false;
  const hp = document.querySelector('input[name="website"]');
  if (hp && hp.value) return true; // бот: делаем вид, что всё отправлено
  try {
    const last = +localStorage.getItem('imer-lead-at') || 0;
    if (Date.now() - last < 60000) return true;
    localStorage.setItem('imer-lead-at', String(Date.now()));
  } catch (e) {}
  const clean = {};
  Object.keys(lead).forEach((k) => { clean[k] = String(lead[k] ?? '').slice(0, k === 'desc' ? 4000 : 500); });
  clean.t = Math.round((Date.now() - IMER_T0) / 1000);
  fetch(LEADS_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(clean) }).catch(() => {});
  return true;
};

/* IMERSIVA — интерактивность сайта (без зависимостей).
   Блоки: меню, cookie, глаз за курсором, калькулятор потерь, квизы (услуги, обучение),
   фильтр кейсов, бриф из 4 шагов. Логика взята из макета в Claude Design. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const setIf = (name, on) => $$(`[data-if="${name}"]`).forEach((e) => { e.hidden = !on; });
  /* неразрывные пробелы: предлоги и короткие слова не висят в конце строки */
  const NB = '\u00a0';
  const typo = (v) => String(v)
    .replace(/(^|[\s(«"])(в|во|с|со|к|ко|о|об|обо|у|и|а|но|на|по|за|из|от|до|не|ни|для|без|под|над|про|при|или|как|что) +(?=\S)/g, `$1$2${NB}`)
    .replace(/(^|[\s(«"])(в|во|с|со|к|ко|о|об|обо|у|и|а|но|на|по|за|из|от|до|не|ни|для|без|под|над|про|при|или|как|что) +(?=\S)/g, `$1$2${NB}`)
    .replace(/ +(—|–) /g, `${NB}$1 `)
    .replace(/(\d) (?=\d{3}\b|₽|%)/g, `$1${NB}`);
  const setT = (name, v) => $$(`[data-t="${name}"]`).forEach((e) => { e.textContent = typo(v); });
  const page = document.body.dataset.page;
  const fmt = (n) => Math.round(n).toLocaleString('ru-RU');

  /* ---------- мобильное меню ---------- */
  const burger = $('#burger'), mm = $('#mmenu');
  if (burger && mm) {
    const set = (o) => { mm.classList.toggle('open', o); burger.classList.toggle('x', o); burger.setAttribute('aria-expanded', String(o)); };
    burger.addEventListener('click', () => set(!mm.classList.contains('open')));
    $$('a', mm).forEach((a) => a.addEventListener('click', () => set(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  }

  /* ---------- баннер cookie ---------- */
  const ck = $('#cookie');
  if (ck) {
    let seen = false;
    try { seen = !!localStorage.getItem('imer-cookie'); } catch (e) { /* storage недоступен */ }
    ck.hidden = seen;
    $$('[data-cookie]', ck).forEach((b) => b.addEventListener('click', () => {
      try { localStorage.setItem('imer-cookie', b.dataset.cookie); } catch (e) {}
      ck.hidden = true;
      // TODO: при значении "all" подключить счётчики аналитики (Яндекс Метрика и т.п.)
    }));
  }

  /* ---------- калькулятор потерь (главная) ---------- */
  if ($('#c-v')) {
    const ids = ['c-v', 'c-c1', 'c-c2', 'c-k'];
    const upd = () => {
      const v = +$('#c-v').value, c1 = +$('#c-c1').value, c2 = +$('#c-c2').value, k = +$('#c-k').value;
      const d = c2 - c1, loss = d > 0 ? v * d / 100 * k : 0;
      setT('vTxt', fmt(v)); setT('c1', c1); setT('c2', c2); setT('kTxt', fmt(k));
      setT('lossTxt', fmt(loss)); setT('yearTxt', fmt(loss * 12));
      setIf('noGrowth', d <= 0);
    };
    ids.forEach((i) => $('#' + i).addEventListener('input', upd));
    upd();
  }

  /* ---------- квизы (услуги и обучение) ---------- */
  const quizBtns = $$('[data-q]');
  if (quizBtns.length) {
    const st = { a: null, b: null, c: null };
    const evalServices = () => {
      const ready = !!(st.a && st.b && st.c);
      let dir = '', pack = '', price = '';
      if (ready) {
        if (st.a === 'A') {
          if (st.c === 'X') { dir = 'Лендинг на Tilda'; pack = 'Старт'; price = 'от 25 000 ₽'; }
          else if (st.c === 'Y') { dir = 'Web-дизайн с разработкой'; pack = 'Старт'; price = 'от 35 000 ₽'; }
          else { dir = 'Web-дизайн с разработкой'; pack = 'Под ключ'; price = 'корпоративный сайт от 55 000 ₽'; }
        } else if (st.a === 'B') {
          dir = 'Инфографика WB / Ozon';
          if (st.b === '3') { pack = 'Старт'; price = 'обложка 1 000 ₽ + слайд 800 ₽'; }
          else { pack = 'Под ключ'; price = 'серия по брифу: обложка 1 000 ₽, слайд 800 ₽, rich-контент 1 800 ₽'; }
        } else if (st.a === 'C') { dir = 'Брендинг'; pack = st.b === '1' ? 'Под ключ' : 'Старт'; price = 'полиграфия от 3 000 ₽, логотип и стиль — по брифу'; }
        else { dir = 'Презентации'; pack = st.c === 'Z' ? 'Под ключ' : 'Старт'; price = st.c === 'Z' ? '15 000 ₽' : '6 000 ₽'; }
      }
      setIf('ready', ready); setIf('notReady', !ready); setIf('recAudit', ready && st.b === '2');
      setT('recDir', dir); setT('recPack', pack); setT('recPrice', price);
    };
    const evalLearn = () => {
      const ready = !!(st.a && st.b && st.c);
      setIf('ready', ready); setIf('waiting', !ready);
      if (!ready) return;
      const map = {
        ui: ['Дизайн', 'UI/UX Design', 'Дизайн PRO — 64 900 ₽'],
        graphic: ['Дизайн', 'Graphic Design', 'Дизайн PRO — 64 900 ₽'],
        code: ['Разработка', st.b === 'zero' ? 'Frontend' : 'Full Stack', 'Разработка PRO — 74 900 ₽'],
        product: ['Комплексный', 'Product: digital-продукты', 'Комплексный PRO — 119 900 ₽'],
      };
      const fmtName = { self: 'самостоятельный формат', group: 'групповой формат', mentor: 'индивидуальный формат' };
      const [dir, spec, price] = map[st.a];
      setT('rDir', dir); setT('rSpec', spec); setT('rFormat', fmtName[st.c]);
      setT('rPrice', st.b === 'pro' ? 'отдельные модули — от 9 900 ₽' : price);
      setT('rNote', st.b === 'pro'
        ? 'База у вас есть: возьмите модули, которых не хватает, или интенсив — от 24 900 ₽ за месяц.'
        : st.b === 'zero' ? 'Начнём с основ: в каждой специализации первые модули — про базу.' : 'Пропустим то, что вы уже знаете, и сфокусируемся на практике и портфолио.');
    };
    const evaluate = page === 'learn' ? evalLearn : evalServices;
    quizBtns.forEach((b) => b.addEventListener('click', () => {
      st[b.dataset.q] = b.dataset.v;
      $$(`[data-q="${b.dataset.q}"]`).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      evaluate();
    }));
    $$('[data-action="reset"]').forEach((b) => b.addEventListener('click', () => {
      st.a = st.b = st.c = null;
      quizBtns.forEach((x) => x.setAttribute('aria-pressed', 'false'));
      evaluate();
    }));
    evaluate();
  }

  /* ---------- фильтр кейсов ---------- */
  const fBtns = $$('[data-f]');
  if (fBtns.length) {
    const apply = (f) => {
      fBtns.forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.f === f)));
      ['site', 'info', 'brand', 'deck'].forEach((k) => setIf('show' + k[0].toUpperCase() + k.slice(1), f === 'all' || f === k));
    };
    fBtns.forEach((b) => b.addEventListener('click', () => apply(b.dataset.f)));
  }

  /* ---------- бриф из 4 шагов ---------- */
  if (page === 'brief' && !document.getElementById('brief2')) {
    let step = 1, tried = 0;
    const back = $('[data-action="back"]'), next = $('[data-action="next"]');
    const anyDir = () => $$('input[name="dir"]:checked').length > 0;
    const nameOk = () => ($('#b-name')?.value || '').trim().length > 0;
    const contactOk = () => ($('#b-contact')?.value || '').trim().length > 2;
    const consentOk = () => !!$('#b-consent')?.checked;
    const valid = () => (step === 1 ? anyDir() : step === 4 ? nameOk() && contactOk() && consentOk() : true);
    const render = () => {
      [1, 2, 3, 4].forEach((n) => setIf('is' + n, n === step));
      const bar = $('#bar'); if (bar) bar.style.width = step * 25 + '%';
      setT('step', step); setT('nextLabel', step === 4 ? 'Отправить бриф' : 'Дальше');
      $$('[data-step]').forEach((li) => { const n = +li.dataset.step; li.className = n === step ? 'on' : n < step ? 'done' : ''; });
      if (back) back.disabled = step === 1;
      const show = tried === step;
      setT('err1', show && !anyDir() ? 'Выберите хотя бы одно направление.' : '');
      setT('errName', show && !nameOk() ? 'Укажите имя.' : '');
      setT('errContact', show && !contactOk() ? 'Оставьте телефон или Telegram — иначе не сможем ответить.' : '');
      setT('errConsent', show && !consentOk() ? 'Нужно согласие на обработку данных.' : '');
    };
    const send = () => {
      const pick = (n) => $$(`input[name="${n}"]:checked`).map((i) => i.closest('label')?.innerText.trim() || i.value);
      const lead = {
        date: new Date().toLocaleString('ru-RU'),
        name: ($('#b-name')?.value || '').trim(),
        contact: ($('#b-contact')?.value || '').trim(),
        method: pick('method').join(', '),
        dir: pick('dir').join(', '),
        desc: ($('#b-desc')?.value || '').trim(),
        links: ($('#b-links')?.value || '').trim(),
        when: pick('when').join(', '),
        budget: pick('budget').join(', '),
        page: location.pathname.split('/').pop() || 'brief',
      };
      // Ссылка веб-приложения Google Apps Script (см. docs/zayavki-podklyuchenie.md).
      sendLead(lead);
      setIf('notSent', false); setIf('sent', true);
    };
    next?.addEventListener('click', () => {
      if (!valid()) { tried = step; render(); return; }
      tried = 0;
      if (step === 4) send(); else { step += 1; render(); }
    });
    back?.addEventListener('click', () => { step = Math.max(1, step - 1); tried = 0; render(); });
    $$('[data-action="restart"]').forEach((b) => b.addEventListener('click', () => { step = 1; tried = 0; setIf('sent', false); setIf('notSent', true); render(); }));
    $$('input, textarea').forEach((el) => el.addEventListener('input', () => { if (tried) render(); }));
    render();
  }
})();

/* ---------- выпадающее меню «Услуги» (клик, клавиатура, тач) ---------- */
(() => {
  const dd = document.querySelector('[data-dd]');
  if (!dd) return;
  const btn = dd.querySelector('.dd-btn');
  const set = (o) => { dd.classList.toggle('open', o); dd.classList.remove('closed'); btn.setAttribute('aria-expanded', String(o)); };
  btn.addEventListener('click', (e) => { e.stopPropagation(); set(!dd.classList.contains('open')); });
  document.addEventListener('click', (e) => { if (!dd.contains(e.target)) set(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { set(false); dd.classList.add('closed'); btn.blur(); } });
  dd.querySelectorAll('.menu a').forEach((a) => a.addEventListener('click', () => { set(false); dd.classList.add('closed'); }));
  dd.addEventListener('mouseleave', () => dd.classList.remove('closed'));
})();

/* ---------- кейсы: фильтр, до/после, просмотр ---------- */
(() => {
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  $$('.ba2 input').forEach((inp) => {
    const box = inp.closest('.ba2');
    const set = () => box.style.setProperty('--x', inp.value + '%');
    inp.addEventListener('input', set); set();
  });
  const cf = $$('[data-cf]');
  cf.forEach((b) => b.addEventListener('click', () => {
    const f = b.dataset.cf;
    cf.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    $$('.cs-index li, article.cs').forEach((el) => { el.hidden = !(f === 'all' || (el.dataset.k || '').split(' ').includes(f)); });
  }));
  const lb = document.getElementById('lb');
  if (lb && typeof lb.showModal === 'function') {
    const im = lb.querySelector('img');
    $$('[data-zoom]').forEach((b) => b.addEventListener('click', () => {
      im.src = b.dataset.zoom; im.alt = b.querySelector('img')?.alt || '';
      lb.showModal();
    }));
    lb.querySelector('.lb-x').addEventListener('click', () => lb.close());
    lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });
  }
})();

/* ---------- обучение: вкладки специализаций ---------- */
(() => {
  const tabs = Array.from(document.querySelectorAll('[data-tab]'));
  tabs.forEach((t) => t.addEventListener('click', () => {
    tabs.forEach((x) => { const on = x === t; x.setAttribute('aria-selected', String(on)); x.setAttribute('aria-pressed', String(on)); });
    document.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== t.dataset.tab; });
  }));
})();

/* ---------- лаборатория: цена рутины ---------- */
(() => {
  const h = document.getElementById('r-h'), p = document.getElementById('r-p');
  if (!h || !p) return;
  const fmt = (n) => Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
  const out = (k, v) => document.querySelectorAll(`[data-out="${k}"]`).forEach((e) => { e.textContent = v; });
  const calc = () => {
    const hm = +h.value * 4, rub = hm * +p.value;
    out('rh', h.value); out('rp', fmt(+p.value)); out('rm', fmt(hm)); out('rr', fmt(rub)); out('ry', fmt(rub * 12));
  };
  h.addEventListener('input', calc); p.addEventListener('input', calc); calc();
})();

/* ---------- глубина первого экрана: слои плывут за курсором с инерцией ----------
   Знак, карточки и шары двигаются с разной силой; значения догоняют курсор плавно (lerp),
   а не прыгают за ним. Только для мыши и без «уменьшить движение». */
(() => {
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || reduce) return;
  const L = [];
  const eye = document.getElementById('eye');
  if (eye) L.push({ el: eye, x: 4.5, y: 2.6, svg: true });
  const hero = document.querySelector('.hero');
  if (hero) {
    [['.hero-mark', 8, 5], ['.hero-cards', -16, -10], ['.orb:not(.sm)', 26, 18], ['.orb.sm', -34, -24]]
      .forEach(([s, x, y]) => hero.querySelectorAll(s).forEach((el) => L.push({ el, x, y })));
  }
  if (!L.length) return;
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, live = true;
  const tick = () => {
    cx += (tx - cx) * 0.075; cy += (ty - cy) * 0.075;
    for (const l of L) {
      const x = (cx * l.x).toFixed(2), y = (cy * l.y).toFixed(2);
      if (l.svg) l.el.setAttribute('transform', `translate(${x} ${y})`);
      else l.el.style.translate = `${x}px ${y}px`;
    }
    raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.0005 ? requestAnimationFrame(tick) : 0;
  };
  if (hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { live = e.isIntersecting || !hero.contains(eye); }).observe(hero);
  }
  addEventListener('pointermove', (e) => {
    if (!live) return;
    tx = (e.clientX / innerWidth - 0.5) * 2; ty = (e.clientY / innerHeight - 0.5) * 2;
    if (!raf) raf = requestAnimationFrame(tick);
  }, { passive: true });
})();

/* ---------- проявление блоков там, где нет scroll-timeline (Firefox) ---------- */
(() => {
  if (CSS.supports('animation-timeline: view()') || !('IntersectionObserver' in window)) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const items = document.querySelectorAll('.rv');
  if (!items.length) return;
  document.documentElement.classList.add('io');
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -12% 0px' });
  items.forEach((el) => io.observe(el));
})();
