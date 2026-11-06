// App behavior: load settings, read storage, draw entries, then attach button actions.
'use strict';
// Settings live in config.js. A path-specific key separates apps on GitHub Pages.
const settings = globalThis.APP_CONFIG;
const basePath = new URL('./', location.href).pathname;
const KEY = settings.storageId + ':' + basePath;
document.querySelector('#app-name').textContent = settings.name;
document.querySelector('#input-label').textContent = settings.inputLabel;
document.querySelector('#save').textContent = settings.saveLabel;
document.querySelector('#archive-heading').textContent = settings.archiveLabel;
document.querySelector('#empty').textContent = settings.emptyMessage;
for (const [key, value] of Object.entries(settings.colors)) document.documentElement.style.setProperty('--' + key, value);
const form = document.querySelector('#capture');
const input = document.querySelector('#sentence');
const list = document.querySelector('#entries');
const status = document.querySelector('#status');
const cancel = document.querySelector('#cancel');
let editing = null;
let entries = [];
let readable = true;

function announce(message, error = false) {
  status.textContent = message;
  status.classList.toggle('error', error);
}
function readEntries() {
  const raw = localStorage.getItem(KEY);
  const value = raw === null ? [] : JSON.parse(raw);
  if (!Array.isArray(value) || value.some(e => !e || typeof e.id !== 'string' || typeof e.text !== 'string' || !Number.isFinite(e.createdAt) || !Number.isFinite(new Date(e.createdAt).getTime()))) throw new Error('Invalid archive');
  return value;
}
function refresh() {
  try { entries = readEntries(); readable = true; }
  catch { readable = false; announce('Your archive could not be opened. Existing data has not been changed. Check browser storage access and reload.', true); }
  render();
}
function persist(next) {
  try { localStorage.setItem(KEY, JSON.stringify(next)); entries = next; return true; }
  catch { announce('Could not save. Browser storage may be full or blocked. Your text is still here; copy it before closing.', true); return false; }
}
function finishEdit(clearDraft = true) {
  editing = null; if (clearDraft) input.value = ''; cancel.hidden = true;
  document.querySelector('#save').textContent = settings.saveLabel;
  document.querySelector('#input-label').textContent = settings.inputLabel;
}
function render() {
  list.replaceChildren();
  document.querySelector('#count').textContent = String(entries.length).padStart(2, '0');
  document.querySelector('#empty').hidden = entries.length > 0 || !readable;
  for (const entry of [...entries].sort((a, b) => b.createdAt - a.createdAt)) {
    const item = document.createElement('li');
    const text = document.createElement('p'); text.className = 'sentence'; text.textContent = entry.text;
    const bottom = document.createElement('div'); bottom.className = 'entry-bottom';
    const time = document.createElement('time');
    time.dateTime = new Date(entry.createdAt).toISOString();
    time.textContent = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(entry.createdAt);
    const actions = document.createElement('div'); actions.className = 'entry-actions';
    const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'Edit';
    edit.setAttribute('aria-label', `Edit: ${entry.text}`);
    edit.onclick = () => {
      if (editing === entry.id) { input.focus(); return; }
      if (input.value.trim() && editing !== entry.id && !confirm('Replace the text currently in the writing field?')) return;
      editing = entry.id; input.value = entry.text; cancel.hidden = false;
      document.querySelector('#save').textContent = 'SAVE CHANGES';
      document.querySelector('#input-label').textContent = 'Edit note.';
      announce(''); input.focus(); form.scrollIntoView({ block: 'start' });
    };
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Delete';
    remove.setAttribute('aria-label', `Delete: ${entry.text}`);
    remove.onclick = () => {
      if (!confirm('Delete this note? This cannot be undone.')) return;
      refresh(); if (!readable) return;
      if (persist(entries.filter(e => e.id !== entry.id))) {
        const keepDraft = editing === entry.id;
        if (keepDraft) finishEdit(false);
        render(); announce(keepDraft ? 'Deleted. Your text is still here; save it as a new note.' : 'Deleted.'); input.focus();
      }
    };
    actions.append(edit, remove); bottom.append(time, actions); item.append(text, bottom); list.append(item);
  }
}
form.addEventListener('submit', event => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) { announce('Write a note first.'); input.focus(); return; }
  refresh(); if (!readable) return;
  if (editing && !entries.some(e => e.id === editing)) { announce('This note was deleted in another window. Copy your text, then cancel to start a new entry.', true); return; }
  const next = editing ? entries.map(e => e.id === editing ? { ...e, text } : e) : [...entries, { id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, text, createdAt: Date.now() }];
  const message = editing ? 'Changes saved.' : 'Saved.';
  if (persist(next)) { finishEdit(); render(); announce(message); input.focus(); }
});
cancel.addEventListener('click', () => { finishEdit(); announce('Edit canceled.'); input.focus(); });
window.addEventListener('storage', event => { if (event.key === KEY || event.key === null) refresh(); });
refresh();
if ('serviceWorker' in navigator && ['https:', 'http:'].includes(location.protocol)) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* Saving still works without offline caching. */ });
}
