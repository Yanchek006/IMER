/* Куда отправлять заявки из брифа: вставьте ссылку веб-приложения Google Apps Script */
const LEADS_URL = 'https://script.google.com/macros/s/AKfycbwe8pM6yYGziMoyXRSFxxYlsCNxvEnRHUOZkQxMs_quilj-NX63dvwrE31ynjlatocO/exec';
                   
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
          if (st.c === 'X') { dir = 'Лендинг на Tilda'; pack = 'Старт'; price = 'стоимость — индивидуально'; }
          else if (st.c === 'Y') { dir = 'Web-дизайн с разработкой'; pack = 'Старт'; price = 'стоимость — индивидуально'; }
          else { dir = 'Web-дизайн с разработкой'; pack = 'Под ключ'; price = 'стоимость — индивидуально'; }
        } else if (st.a === 'B') {
          dir = 'Инфографика WB / Ozon';
          if (st.b === '3') { pack = 'Старт'; price = 'стоимость — индивидуально'; }
          else { pack = 'Под ключ'; price = 'стоимость — индивидуально'; }
        } else if (st.a === 'C') { dir = 'Брендинг'; pack = st.b === '1' ? 'Под ключ' : 'Старт'; price = 'стоимость — индивидуально'; }
        else { dir = 'Презентации'; pack = st.c === 'Z' ? 'Под ключ' : 'Старт'; price = st.c === 'Z' ? 'стоимость — индивидуально' : 'стоимость — индивидуально'; }
      }
      setIf('ready', ready); setIf('notReady', !ready); setIf('recAudit', ready && st.b === '2');
      setT('recDir', dir); setT('recPack', pack); setT('recPrice', price);
    };
    const evalLearn = () => {
      const ready = !!(st.a && st.b && st.c);
      setIf('ready', ready); setIf('waiting', !ready);
      if (!ready) return;
      const map = {
        ui: ['Дизайн', 'UI/UX Design', 'Дизайн PRO'],
        graphic: ['Дизайн', 'Graphic Design', 'Дизайн PRO'],
        code: ['Разработка', st.b === 'zero' ? 'Frontend' : 'Full Stack', 'Разработка PRO'],
        product: ['Комплексный', 'Product: digital-продукты', 'Комплексный PRO'],
      };
      const fmtName = { self: 'самостоятельный формат', group: 'групповой формат', mentor: 'индивидуальный формат' };
      const [dir, spec, price] = map[st.a];
      setT('rDir', dir); setT('rSpec', spec); setT('rFormat', fmtName[st.c]);
      setT('rPrice', st.b === 'pro' ? 'отдельные модули' : price);
      setT('rNote', st.b === 'pro'
        ? 'База у вас есть: возьмите модули, которых не хватает, или интенсив.'
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
    /* тянуть можно с любой точки: на iPhone range не двигается по касанию мимо бегунка */
    let on = false;
    const move = (e) => {
      const r = box.getBoundingClientRect();
      inp.value = Math.round(Math.min(100, Math.max(0, (e.clientX - r.left) / r.width * 100)));
      set();
    };
    box.addEventListener('pointerdown', (e) => { on = true; box.setPointerCapture?.(e.pointerId); move(e); });
    box.addEventListener('pointermove', (e) => { if (on) move(e); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => box.addEventListener(t, () => { on = false; }));
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
  const appleWK = CSS.supports('font', '-apple-system-body'); // Safari: там scroll-timeline отключён в CSS
  if ((CSS.supports('animation-timeline: view()') && !appleWK) || !('IntersectionObserver' in window)) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const items = document.querySelectorAll('.rv');
  if (!items.length) return;
  document.documentElement.classList.add('io');
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) e.target.classList.add('in');
    else if (e.boundingClientRect.top > 0) e.target.classList.remove('in'); // листаем вверх — блок уходит обратно
  }), { rootMargin: '0px 0px -12% 0px' });
  items.forEach((el) => io.observe(el));
})();

/* ---------- сцены прокрутки: погружение в арку и слияние кругов ----------
   Работает одинаково во всех браузерах, включая Safari на iPhone. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const pinned = (pin) => getComputedStyle(pin).position === 'sticky';
  const scenes = [];

  /* погружение в арку */
  const im = document.querySelector('.immerse');
  if (im) {
    const pin = im.querySelector('.pin');
    const svg = pin.querySelector('svg');
    let flood = pin.querySelector('.flood');
    if (!flood) { flood = document.createElement('div'); flood.className = 'flood'; flood.setAttribute('aria-hidden', 'true'); pin.insertBefore(flood, pin.querySelector('.inside')); }
    const draw = (p) => {
      // арка увеличивается умеренно (без огромного масштаба, который дёргается на телефонах),
      // а внутрь «заливает» красным слоем
      const s = Math.pow(9, ease(clamp(p / 0.7)));
      svg.style.transform = 'translate3d(0,0,0) scale(' + s.toFixed(4) + ')';
      flood.style.opacity = clamp((p - 0.42) / 0.2).toFixed(3);
      pin.style.setProperty('--o', clamp((p - 0.55) / 0.23).toFixed(3));
    };
    if (reduce) draw(1);
    else {
      let cur = -1, busy = false;
      scenes.push({ el: im, get live() { return busy; }, tick() {
        const r = im.getBoundingClientRect(), vh = innerHeight;
        const target = pinned(pin) ? clamp(-r.top / Math.max(1, r.height - pin.offsetHeight)) : clamp((vh - r.top) / (vh + r.height * 0.4));
        if (cur < 0) cur = target;
        cur += (target - cur) * 0.16;            // мягкое сглаживание: без рывков при прокрутке пальцем
        if (Math.abs(target - cur) < 0.0006) cur = target;
        busy = cur !== target;
        draw(cur);
      } });
    }
  }

  /* три круга сливаются в один */
  const bx = document.getElementById('blobs');
  if (bx) {
    const sec = bx.closest('.merge'), pin = sec.querySelector('.pin');
    const L = bx.querySelector('.b-l'), R = bx.querySelector('.b-r'), M = bx.querySelector('.b-m'), ring = bx.querySelector('.b-ring');
    const drops = Array.from(bx.querySelectorAll('.drop')).map((c) => ({ c, x: +c.getAttribute('cx'), y: +c.getAttribute('cy'), r: +c.getAttribute('r') }));
    const lab = { l: bx.querySelector('.bl-l'), m: bx.querySelector('.bl-m'), r: bx.querySelector('.bl-r'), one: bx.querySelector('.bl-one') };
    const ink = [21, 20, 18], red = [217, 67, 42];
    const mix = (k) => `rgb(${ink.map((v, i) => Math.round(v + (red[i] - v) * k)).join(',')})`;
    const t0 = performance.now();
    const draw = (p, t) => {
      const e = ease(clamp((p - 0.05) / 0.8));
      const w = reduce ? 0 : 1 - e;                       // «дыхание», пока круги не слились
      const wob = (ph) => Math.sin(t * 1.3 + ph) * 9 * w;
      const lx = 200 + 300 * e, rx = 800 - 300 * e, ro = 122 - 10 * e, rm = 122 + 76 * e;
      L.setAttribute('cx', lx.toFixed(1)); L.setAttribute('cy', (220 + wob(0)).toFixed(1)); L.setAttribute('r', ro.toFixed(1));
      R.setAttribute('cx', rx.toFixed(1)); R.setAttribute('cy', (220 + wob(2.1)).toFixed(1)); R.setAttribute('r', ro.toFixed(1));
      M.setAttribute('cy', (220 + wob(4.2)).toFixed(1)); M.setAttribute('r', rm.toFixed(1));
      const k = clamp((e - 0.55) / 0.4);
      L.setAttribute('fill', mix(k)); R.setAttribute('fill', mix(k));
      drops.forEach((d, i) => {
        const de = ease(clamp((p - i * 0.07) / 0.55));
        d.c.setAttribute('cx', (d.x + (500 - d.x) * de + Math.cos(t + i) * 6 * w).toFixed(1));
        d.c.setAttribute('cy', (d.y + (220 - d.y) * de + Math.sin(t * 1.2 + i) * 6 * w).toFixed(1));
        d.c.setAttribute('r', (d.r * (1 - de * 0.5)).toFixed(1));
        d.c.style.opacity = (1 - clamp((de - 0.75) / 0.25)).toFixed(3);
      });
      const fade = 1 - clamp((e - 0.2) / 0.25);
      lab.l.style.left = lx / 10 + '%'; lab.r.style.left = rx / 10 + '%';
      lab.l.style.opacity = lab.m.style.opacity = lab.r.style.opacity = fade.toFixed(3);
      const one = clamp((e - 0.82) / 0.18);
      lab.one.style.opacity = one.toFixed(3);
      lab.one.style.transform = `translate(-50%,-50%) scale(${(0.7 + 0.3 * one).toFixed(3)})`;
      const q = clamp((p - 0.82) / 0.18);                 // круг-волна после слияния
      ring.setAttribute('r', (200 + 90 * q).toFixed(1));
      ring.style.opacity = (q > 0 && q < 1 ? (1 - q) * 0.8 : 0).toFixed(3);
    };
    const prog = () => {
      const vh = innerHeight;
      if (pinned(pin)) { const r = sec.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - pin.offsetHeight)); }
      const r = bx.getBoundingClientRect();               // телефон: от появления снизу до верхней трети экрана
      return clamp((vh * 0.95 - r.top) / (vh * 0.8));
    };
    if (reduce) draw(0, 0);
    else scenes.push({ el: sec, live: true, tick(now) { draw(prog(), (now - t0) / 1000); } });
  }

  if (!scenes.length) return;
  let raf = 0;
  const vis = new Set();
  const loop = (now) => {
    raf = 0;
    vis.forEach((sc) => sc.tick(now));
    if ([...vis].some((sc) => sc.live)) raf = requestAnimationFrame(loop); // у кругов «дыхание» и без прокрутки
  };
  const kick = () => { if (!raf && vis.size) raf = requestAnimationFrame(loop); };
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    const sc = scenes.find((x) => x.el === e.target);
    if (e.isIntersecting) vis.add(sc); else { sc.tick(performance.now()); vis.delete(sc); }
  }), { rootMargin: '200px 0px' });
  scenes.forEach((sc) => { io.observe(sc.el); sc.tick(performance.now()); });
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', kick);
  io.takeRecords(); kick();
  setTimeout(kick, 300);
})();

/* ---------- кейсы: слайдеры изображений ---------- */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('[data-sl]').forEach((sl) => {
    const tr = sl.querySelector('.sl-track');
    const ss = Array.from(tr.querySelectorAll('.sl-s'));
    const cnt = sl.querySelector('.sl-n'), bar = sl.querySelector('.sl-bar i');
    const prev = sl.querySelector('.prev'), next = sl.querySelector('.next');
    const pad = (n) => String(n).padStart(2, '0');
    let cur = 0, raf = 0;
    const update = () => {
      raf = 0;
      const tb = tr.getBoundingClientRect(), c = tb.left + tb.width / 2;
      let best = 0, bd = Infinity;
      ss.forEach((s, i) => {
        const b = s.getBoundingClientRect();
        const d = (b.left + b.width / 2 - c) / tb.width;     // −1…1: где кадр относительно центра
        const a = Math.min(1, Math.abs(d) * 1.4);
        if (!reduce) {
          s.style.transform = `perspective(1400px) rotateY(${(-d * 16).toFixed(2)}deg) scale(${(1 - a * 0.1).toFixed(3)}) translateY(${(a * 10).toFixed(1)}px)`;
          s.style.opacity = (1 - a * 0.4).toFixed(3);
        }
        if (Math.abs(d) < bd) { bd = Math.abs(d); best = i; }
      });
      cur = best;
      cnt.textContent = pad(best + 1) + ' / ' + pad(ss.length);
      bar.style.transform = `scaleX(${(best + 1) / ss.length})`;
      prev.disabled = tr.scrollLeft < 4;
      next.disabled = tr.scrollLeft > tr.scrollWidth - tr.clientWidth - 4;
    };
    const req = () => { if (!raf) raf = requestAnimationFrame(update); };
    const go = (i) => {
      const t = ss[Math.max(0, Math.min(ss.length - 1, i))];
      tr.scrollTo({ left: t.offsetLeft - (tr.clientWidth - t.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
      sl.classList.add('used');
    };
    tr.addEventListener('scroll', () => { req(); if (tr.scrollLeft > 20) sl.classList.add('used'); }, { passive: true });
    addEventListener('resize', req);
    prev.addEventListener('click', () => go(cur - 1));
    next.addEventListener('click', () => go(cur + 1));
    tr.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); }
    });
    /* мышью ленту можно тянуть; если тянули — клик не открывает картинку */
    let down = false, sx = 0, sl0 = 0, moved = false;
    tr.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; moved = false; sx = e.clientX; sl0 = tr.scrollLeft;
    });
    addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (!moved && Math.abs(dx) > 6) { moved = true; tr.classList.add('drag'); }
      if (moved) tr.scrollLeft = sl0 - dx;
    });
    addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      if (moved) { tr.classList.remove('drag'); update(); go(cur); }
    });
    tr.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    ss.forEach((s) => s.querySelector('img')?.addEventListener('load', req));
    update();
  });
})();

/* Заголовки: если самое длинное слово не помещается в ширину экрана,
   плавно уменьшаем шрифт, чтобы слово не разрывалось посередине. */
(() => {
  const SEL = 'h1,h2,h3,.h-xxl,.h-xl,.h-l,.h-m,.mmenu a,.price b';
  const els = Array.from(document.querySelectorAll(SEL));
  const fit = (el) => {
    const w = el.clientWidth;
    if (!w || el._fitW === w) return;
    el._fitW = w;
    el.style.fontSize = '';
    let fs = parseFloat(getComputedStyle(el).fontSize), n = 0;
    while (el.scrollWidth > w + 1 && fs > 13 && n++ < 40) {
      fs *= 0.95;
      el.style.fontSize = fs.toFixed(2) + 'px';
    }
  };
  const all = () => els.forEach((el) => { el._fitW = 0; fit(el); });
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver((list) => list.forEach((e) => fit(e.target)));
    els.forEach((el) => ro.observe(el));
  } else {
    window.addEventListener('resize', all);
  }
  all();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(all);
  window.addEventListener('load', all);
})();

/* Плавное раскрытие и закрытие частых вопросов и программ (во всех браузерах). */
(() => {
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = 'cubic-bezier(.2,.8,.2,1)';
  document.querySelectorAll('.faq details, .prog details').forEach((d) => {
    const s = d.querySelector('summary');
    if (!s || !d.animate) return;
    let anim = null;
    const finish = (open) => {
      d.open = open;
      d.style.height = '';
      d.classList.remove('is-opening', 'is-closing');
      anim = null;
    };
    s.addEventListener('click', (e) => {
      if (reduce) return;
      e.preventDefault();
      const from = d.offsetHeight;
      if (anim) anim.cancel();
      const opening = !d.open || d.classList.contains('is-closing');
      d.classList.remove('is-opening', 'is-closing');
      let to;
      if (opening) {
        d.open = true;
        to = d.offsetHeight;
        d.classList.add('is-opening');
        requestAnimationFrame(() => requestAnimationFrame(() => d.classList.remove('is-opening')));
      } else {
        d.open = false; to = d.offsetHeight; d.open = true;
        d.classList.add('is-closing');
      }
      const dur = Math.min(520, Math.max(280, Math.abs(to - from) * 1.4));
      anim = d.animate({ height: [from + 'px', to + 'px'] }, { duration: dur, easing: EASE });
      anim.onfinish = () => finish(opening);
      anim.oncancel = () => { anim = null; };
    });
  });
})();
