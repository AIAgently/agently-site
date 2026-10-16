// URL вебхука n8n — друг вставит сюда production URL из Webhook-ноды
const WEBHOOK_URL = 'https://n8n.YOUR-DOMAIN/webhook/agently-lead';

const form = document.getElementById('lead-form');
const statusEl = form.querySelector('.form__status');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));

  // Ловушка для спам-ботов: настоящие люди это поле не видят
  if (data.website) return;

  let valid = true;
  ['name', 'contact'].forEach((field) => {
    const input = form.elements[field];
    const empty = !input.value.trim();
    input.classList.toggle('invalid', empty);
    if (empty) valid = false;
  });
  if (!valid) {
    setStatus('Заполните имя и контакт, чтобы мы могли ответить.', 'err');
    return;
  }

  const button = form.querySelector('button');
  button.disabled = true;
  setStatus('Отправляем…');

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name.trim(),
        contact: data.contact.trim(),
        task: (data.task || '').trim(),
        page: location.href,
        sentAt: new Date().toISOString(),
      }),
    });
    if (!res.ok) throw new Error(res.status);
    form.reset();
    setStatus('Заявка отправлена. Напишем вам в течение дня.', 'ok');
  } catch {
    setStatus('Не получилось отправить. Напишите нам в Telegram, ссылка слева.', 'err');
  } finally {
    button.disabled = false;
  }
});

function setStatus(text, type = '') {
  statusEl.textContent = text;
  statusEl.className = 'form__status' + (type ? ' ' + type : '');
}
