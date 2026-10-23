// Чат с ИИ-ассистентом agently
(() => {
  const CHAT_URL = 'https://qeenek.space/webhook/agently-chat';
  const MAX_LEN = 600;
  const GREETING = 'Привет! Я ИИ-ассистент agently. Расскажу о нас и наших услугах и подскажу, что можно автоматизировать в вашем бизнесе. С чего начнём?';
  const SUGGESTIONS = ['Что вы умеете?', 'У меня кафе. Что можно автоматизировать?', 'Сколько это стоит?'];

  // Диалог хранится в браузере посетителя 30 дней: вернувшись, он продолжит тот же разговор
  const TTL = 30 * 24 * 60 * 60 * 1000;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  const lastSeen = Number(store.get('agently-chat-seen') || 0);
  if (lastSeen && Date.now() - lastSeen > TTL) {
    store.del('agently-chat-id'); store.del('agently-chat-history');
  }
  store.set('agently-chat-seen', String(Date.now()));
  let sessionId = store.get('agently-chat-id');
  if (!sessionId) {
    sessionId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
    store.set('agently-chat-id', sessionId);
  }
  let history = [];
  try { history = JSON.parse(store.get('agently-chat-history') || '[]'); } catch (e) { history = []; }

  // ---------- разметка ----------
  const root = document.createElement('div');
  root.className = 'chatw';
  root.innerHTML = `
    <button class="chatw__launch" type="button" aria-expanded="false" aria-controls="chatw-panel">
      <span class="chatw__dot" aria-hidden="true"></span>Спросить ассистента
    </button>
    <section class="chatw__panel" id="chatw-panel" role="dialog" aria-label="Чат с ассистентом agently" hidden>
      <header class="chatw__head">
        <span class="chatw__avatar" aria-hidden="true">a</span>
        <div class="chatw__title"><b>Ассистент agently</b><small>отвечает сразу</small></div>
        <button class="chatw__close" type="button" aria-label="Закрыть чат">×</button>
      </header>
      <div class="chatw__log" role="log" aria-live="polite"></div>
      <div class="chatw__chips"></div>
      <form class="chatw__form">
        <textarea class="chatw__input" id="chatw-input" rows="1" maxlength="${MAX_LEN}" placeholder="Напишите сообщение…" aria-label="Сообщение"></textarea>
        <button class="chatw__send" type="submit" aria-label="Отправить">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 12l16-8-6 16-2.5-6.5L4 12z" fill="currentColor"/></svg>
        </button>
      </form>
      <p class="chatw__note">Отвечает ИИ, он может ошибаться. Не отправляйте в чат личные данные. Чтобы заказать, оставьте заявку в <a href="#contact">форме на странице</a>.</p>
    </section>`;
  document.body.appendChild(root);

  const $ = s => root.querySelector(s);
  const launch = $('.chatw__launch'), panel = $('.chatw__panel'), log = $('.chatw__log'),
        chips = $('.chatw__chips'), form = $('.chatw__form'), input = $('.chatw__input'), send = $('.chatw__send');
  let busy = false;

  // ---------- сообщения ----------
  function linkify(el, text) {
    const re = /((?:https?:\/\/)?(?:agently\.art[^\s,]*|t\.me\/[\w_]+)|@[A-Za-z][\w]{3,})/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      el.appendChild(document.createTextNode(text.slice(last, m.index)));
      const a = document.createElement('a');
      const t = m[0].replace(/[.)]+$/, '');
      a.textContent = t;
      a.href = t.startsWith('@') ? 'https://t.me/' + t.slice(1) : (t.startsWith('http') ? t : 'https://' + t);
      a.target = '_blank'; a.rel = 'noopener';
      el.appendChild(a);
      last = m.index + t.length;
      re.lastIndex = last;
    }
    el.appendChild(document.createTextNode(text.slice(last)));
  }
  function bubble(role, text, save = true) {
    const d = document.createElement('div');
    d.className = 'chatw__msg chatw__msg--' + (role === 'user' ? 'out' : 'in');
    if (role === 'user') d.textContent = text; else linkify(d, text);
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    if (save) { history.push({ role, text }); store.set('agently-chat-history', JSON.stringify(history.slice(-40))); }
  }
  function typing(on) {
    let t = log.querySelector('.chatw__typing');
    if (on && !t) {
      t = document.createElement('div'); t.className = 'chatw__msg chatw__msg--in chatw__typing';
      t.innerHTML = '<i></i><i></i><i></i>'; t.setAttribute('aria-label', 'Ассистент печатает');
      log.appendChild(t); log.scrollTop = log.scrollHeight;
    } else if (!on && t) t.remove();
  }
  function renderChips() {
    chips.innerHTML = '';
    if (history.some(h => h.role === 'user')) return;
    SUGGESTIONS.forEach(s => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chatw__chip'; b.textContent = s;
      b.addEventListener('click', () => ask(s));
      chips.appendChild(b);
    });
  }

  // ---------- отправка ----------
  async function ask(text) {
    text = text.trim().slice(0, MAX_LEN);
    if (!text || busy) return;
    busy = true; send.disabled = true;
    bubble('user', text);
    renderChips();
    input.value = ''; autosize();
    typing(true);
    try {
      const res = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text, page: location.pathname }),
      });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      typing(false);
      bubble('bot', String(data.reply || 'Извините, не расслышал. Повторите, пожалуйста?'));
    } catch (e) {
      typing(false);
      bubble('bot', 'Не получилось связаться с ассистентом. Попробуйте ещё раз чуть позже или оставьте заявку в форме на странице.', false);
    } finally {
      busy = false; send.disabled = false; input.focus();
    }
  }

  // ---------- открытие и ввод ----------
  function open(state) {
    panel.hidden = !state;
    launch.setAttribute('aria-expanded', String(state));
    root.classList.toggle('is-open', state);
    if (state) {
      if (!log.children.length) {
        bubble('bot', GREETING, false);
        history.forEach(h => bubble(h.role, h.text, false));
        renderChips();
      }
      setTimeout(() => input.focus(), 50);
    } else launch.focus();
  }
  function autosize() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; }

  launch.addEventListener('click', () => open(true));
  $('.chatw__close').addEventListener('click', () => open(false));
  root.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) open(false); });
  form.addEventListener('submit', e => { e.preventDefault(); ask(input.value); });
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input.value); } });
  panel.addEventListener('click', e => { const a = e.target.closest('a[href="#contact"]'); if (a) open(false); });
  document.querySelectorAll('[data-open-chat]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); open(true); }));
})();
