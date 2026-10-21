import { loadQueue, saveQueue, validateStep1, validateStep2, chargeRecuperee, createIntervention, summaryEntries, toBsffPayload, toPrintableHtml } from './model.js';

const $ = selector => document.querySelector(selector);
const form = $('#intervention-form');
const canvas = $('#signature');
const context = canvas.getContext('2d');
let step = 1;
let queue = loadQueue();
let signed = false;
let activePointer = null;
let lastPoint = null;
let saving = false;

function readData() {
  return Object.fromEntries(new FormData(form));
}

function setDate() {
  const now = new Date();
  $('#date').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function showError(message, fields = {}) {
  $('#error').textContent = message;
  $('#error').hidden = !message;
  form.querySelectorAll('[aria-invalid]').forEach(input => input.removeAttribute('aria-invalid'));
  for (const name of Object.keys(fields)) {
    form.querySelectorAll(`[name="${name}"]`).forEach(input => input.setAttribute('aria-invalid', 'true'));
  }
  if (message) $('#error').focus();
}

function renderSummary() {
  const summary = $('#summary');
  summary.replaceChildren();
  for (const [label, value] of summaryEntries(readData())) {
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = value;
    summary.append(dt, dd);
  }
}

function navigate(next, focus = true) {
  step = next;
  form.hidden = false;
  $('#confirmation').hidden = true;
  document.querySelectorAll('[data-step]').forEach(section => { section.hidden = Number(section.dataset.step) !== step; });
  $('#queue').hidden = step !== 1;
  $('#title').textContent = ['1. Équipement', '2. Intervention', '3. Signature'][step - 1];
  $('#step-label').textContent = `Étape ${step} sur 3`;
  $('#progress').hidden = false;
  $('#progress').setAttribute('aria-valuenow', String(step));
  $('#progress').querySelectorAll('i').forEach((bar, index) => bar.classList.toggle('active', index < step));
  showError('');
  if (step === 3) renderSummary();
  if (focus) { $('#title').focus(); window.scrollTo(0, 0); }
}

function download(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function renderQueue() {
  $('#queue-title').textContent = `${queue.length} intervention${queue.length > 1 ? 's' : ''} en attente`;
  $('#queue-list').replaceChildren();
  for (const item of queue) {
    const article = document.createElement('article');
    const title = document.createElement('p');
    title.textContent = `${item.marque} ${item.modele} · ${item.date}`;
    const actions = document.createElement('div');
    actions.className = 'export-actions';
    for (const [label, suffix, content, type] of [
      ['Exporter JSON BSFF', 'bsff.json', () => JSON.stringify(toBsffPayload(item), null, 2), 'application/json'],
      ['Document imprimable', 'html', () => toPrintableHtml(item), 'text/html'],
      ['Sauvegarder la fiche', 'json', () => JSON.stringify(item, null, 2), 'application/json']
    ]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.setAttribute('aria-label', `${label} : ${item.marque} ${item.modele}, ${item.date}`);
      button.addEventListener('click', () => download(content(), `frigo-${item.id}.${suffix}`, type));
      actions.append(button);
    }
    article.append(title, actions);
    $('#queue-list').append(article);
  }
}

function updateRecovered() {
  try { $('#chargeRecuperee').value = chargeRecuperee($('#poidsAvant').value, $('#poidsApres').value).toFixed(2); }
  catch { $('#chargeRecuperee').value = '—'; }
}

for (const [id, delta] of [['minus', -0.1], ['plus', 0.1]]) {
  $(`#${id}`).addEventListener('click', () => {
    const input = $('#chargeTotale');
    input.value = (Math.max(0, Math.round(((Number(input.value) || 0) + delta) * 10)) / 10).toFixed(1);
  });
}
$('#poidsAvant').addEventListener('input', updateRecovered);
$('#poidsApres').addEventListener('input', updateRecovered);
$('#nomSignataire').addEventListener('input', renderSummary);
document.querySelectorAll('[data-back]').forEach(button => button.addEventListener('click', () => navigate(step - 1)));

function clearSignature() {
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  signed = false;
  activePointer = null;
  lastPoint = null;
}

function point(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
}

canvas.addEventListener('pointerdown', event => {
  if (activePointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
  event.preventDefault();
  activePointer = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
  lastPoint = point(event);
  context.strokeStyle = '#0b1c30';
  context.fillStyle = '#0b1c30';
  context.lineWidth = 4;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  context.arc(lastPoint.x, lastPoint.y, 2, 0, Math.PI * 2);
  context.fill();
  signed = true;
});
canvas.addEventListener('pointermove', event => {
  if (event.pointerId !== activePointer) return;
  event.preventDefault();
  const next = point(event);
  const middle = { x: (lastPoint.x + next.x) / 2, y: (lastPoint.y + next.y) / 2 };
  context.beginPath();
  context.moveTo(lastPoint.x, lastPoint.y);
  context.quadraticCurveTo(lastPoint.x, lastPoint.y, middle.x, middle.y);
  context.lineTo(next.x, next.y);
  context.stroke();
  lastPoint = next;
});
for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(eventName, event => {
    if (event.pointerId === activePointer) { activePointer = null; lastPoint = null; }
  });
}
$('#clear-signature').addEventListener('click', clearSignature);

form.addEventListener('submit', event => {
  event.preventDefault();
  if (saving) return;
  const data = readData();
  if (step < 3) {
    const errors = step === 1 ? validateStep1(data) : validateStep2(data);
    if (Object.keys(errors).length) return showError(Object.values(errors).join(' '), errors);
    navigate(step + 1);
    return;
  }
  if (!data.nomSignataire.trim() || !signed) return showError('Renseignez le nom du signataire et tracez sa signature.');
  saving = true;
  try {
    const intervention = createIntervention(data, canvas.toDataURL('image/png'));
    const nextQueue = [...queue, intervention];
    saveQueue(nextQueue);
    queue = nextQueue;
    renderQueue();
    form.hidden = true;
    $('#queue').hidden = false;
    $('#confirmation').hidden = false;
    $('#title').textContent = 'Enregistrement terminé';
    $('#step-label').textContent = 'Étape 3 sur 3';
    showError('');
    $('#title').focus();
    window.scrollTo(0, 0);
  } catch (error) {
    showError(`Enregistrement impossible : ${error.message} Votre saisie et votre signature sont conservées à l’écran. Vérifiez l’espace de stockage et réessayez.`);
  } finally { saving = false; }
});

$('#new-intervention').addEventListener('click', () => {
  form.reset();
  setDate();
  updateRecovered();
  clearSignature();
  navigate(1);
});

function updateOnline() { $('#offline').hidden = navigator.onLine !== false; }
window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);
window.addEventListener('storage', () => { queue = loadQueue(); renderQueue(); });
setDate();
clearSignature();
updateOnline();
renderQueue();
navigate(1, false);

if ('serviceWorker' in navigator) {
  // Le script vit dans js/ ; le lanceur de racine lui donne la portée de l'app.
  navigator.serviceWorker.register('./sw.js').then(async () => {
    await navigator.serviceWorker.ready;
    $('#cache-status').textContent = 'Disponible hors connexion sur cet appareil';
  }).catch(() => {
    $('#cache-status').textContent = 'Mode hors ligne indisponible. Ouvrez l’app sur localhost ou en HTTPS puis rechargez.';
  });
} else {
  $('#cache-status').textContent = 'Ce navigateur ne permet pas le mode hors ligne.';
}
