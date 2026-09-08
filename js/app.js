import { cloneRoutine, createRoutine, sanitizeState } from './models.js';
import { playCue, unlockAudio } from './audio.js';
import { RoutineEditor } from './routine-editor.js';
import { RoutinePlayer } from './routine-player.js';
import { parseRouteHash, toRouteHash } from './router.js';
import { loadState, mergeState, replaceState, resetState, saveState } from './storage.js';
import { countSteps, downloadJson, escapeHtml, formatDate, formatDuration, readJsonFile, totalDuration } from './utils.js';

let root = document.querySelector('#app');
const toastRegion = document.querySelector('#toast-region');
let state = loadState();
let activePlayer = null;

function resetViewRoot() {
  const replacement = root.cloneNode(false);
  root.replaceWith(replacement);
  root = replacement;
}

function applyTheme() {
  document.documentElement.dataset.theme = state.settings.theme;
}

function updateState(nextState) {
  state = saveState(nextState);
  applyTheme();
}

function toast(message) {
  const item = document.createElement('div');
  item.className = 'toast';
  item.textContent = message;
  toastRegion.append(item);
  setTimeout(() => item.remove(), 3200);
}

function go(route) {
  location.hash = toRouteHash(route);
}

function parseRoute() {
  return parseRouteHash(location.hash);
}

function renderHome() {
  activePlayer?.destroy();
  activePlayer = null;
  resetViewRoot();
  root.innerHTML = `
    <main class="shell home-shell">
      <header class="hero">
        <div class="brand"><span class="brand-mark" aria-hidden="true">◷</span><span>Ritmo</span></div>
        <button class="icon-button" data-action="settings" aria-label="Apri impostazioni">⌁</button>
        <div class="hero-copy"><span class="eyebrow">Il tuo tempo, con calma</span><h1>Pronto per la prossima routine?</h1><p>Crea sequenze, segui il ritmo e lascia che il timer pensi al resto.</p></div>
      </header>
      <section class="home-heading"><div><span class="eyebrow">Le tue routine</span><h2>${state.routines.length ? 'Scegli da dove iniziare' : 'Crea la prima routine'}</h2></div><button class="button primary" data-action="create">+ Nuova</button></section>
      <section class="routine-grid" aria-label="Routine salvate">
        ${state.routines.map(routineCardMarkup).join('')}
      </section>
      ${state.routines.length ? '' : '<div class="empty-state surface"><h2>Nessuna routine salvata</h2><p>Parti da una sequenza vuota e adattala ai tuoi tempi.</p><button class="button primary" data-action="create">Crea routine</button></div>'}
      <footer class="app-footer"><span>Funziona offline</span><span>I dati restano sul dispositivo</span></footer>
    </main>
    ${settingsDialogMarkup()}`;
  bindHome();
}

function routineCardMarkup(routine) {
  return `
    <article class="routine-card surface" data-routine-id="${routine.id}">
      <div class="routine-card-top"><span class="duration-pill">${formatDuration(totalDuration(routine))}</span><button class="icon-button small" data-action="menu" aria-label="Azioni per ${escapeHtml(routine.name)}">•••</button></div>
      <div><h3>${escapeHtml(routine.name)}</h3><p>${escapeHtml(routine.description || 'Una routine personalizzata.')}</p></div>
      <div class="routine-meta"><span>${countSteps(routine, 'exercise')} esercizi</span><span>${countSteps(routine, 'pause')} pause</span><span>Agg. ${formatDate(routine.updatedAt)}</span></div>
      <div class="routine-card-actions"><button class="button primary grow" data-action="play" ${routine.steps.length ? '' : 'disabled'}>Avvia</button><button class="button secondary" data-action="edit">Modifica</button></div>
      <div class="card-menu" hidden>
        <button data-action="rename">Rinomina</button><button data-action="duplicate">Duplica</button><button class="danger-text" data-action="delete">Elimina</button>
      </div>
    </article>`;
}

function settingsDialogMarkup() {
  return `
    <dialog id="settings-dialog" class="settings-dialog">
      <form method="dialog">
        <header><div><span class="eyebrow">Preferenze</span><h2>Impostazioni</h2></div><button class="icon-button" value="close" aria-label="Chiudi">×</button></header>
        <section class="settings-section">
          <label class="setting-row"><span><strong>Suoni</strong><small>Segnali e fine step</small></span><input name="sound-enabled" type="checkbox" ${state.settings.soundEnabled ? 'checked' : ''}></label>
          <button class="button secondary wide" value="" type="button" data-action="test-sound">Prova suono</button>
          <label class="setting-row"><span><strong>Conto alla rovescia</strong><small>Prima di iniziare</small></span><select name="initial-countdown"><option value="0" ${state.settings.initialCountdown === 0 ? 'selected' : ''}>Nessuno</option><option value="3" ${state.settings.initialCountdown === 3 ? 'selected' : ''}>3 secondi</option><option value="5" ${state.settings.initialCountdown === 5 ? 'selected' : ''}>5 secondi</option></select></label>
          <label class="setting-row"><span><strong>Aspetto</strong><small>Chiaro, scuro o sistema</small></span><select name="theme"><option value="system" ${state.settings.theme === 'system' ? 'selected' : ''}>Sistema</option><option value="light" ${state.settings.theme === 'light' ? 'selected' : ''}>Chiaro</option><option value="dark" ${state.settings.theme === 'dark' ? 'selected' : ''}>Scuro</option></select></label>
        </section>
        <section class="settings-section"><h3>Backup dei dati</h3><div class="data-actions"><button class="button secondary" value="" type="button" data-action="export">Esporta JSON</button><label class="button secondary file-button">Importa JSON<input id="import-file" type="file" accept="application/json,.json"></label></div><button class="text-button danger-text" value="" type="button" data-action="reset">Ripristina dati iniziali</button></section>
      </form>
    </dialog>`;
}

function bindHome() {
  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    const card = button.closest('[data-routine-id]');
    const routine = state.routines.find((item) => item.id === card?.dataset.routineId);
    if (action === 'create') {
      const created = createRoutine();
      updateState({ ...state, routines: [...state.routines, created] });
      go(`edit/${created.id}`);
    }
    if (action === 'play' && routine) {
      void unlockAudio();
      go(`play/${routine.id}`);
    }
    if (action === 'edit' && routine) go(`edit/${routine.id}`);
    if (action === 'menu' && card) {
      const menu = card.querySelector('.card-menu');
      root.querySelectorAll('.card-menu').forEach((item) => { if (item !== menu) item.hidden = true; });
      menu.hidden = !menu.hidden;
    }
    if (action === 'rename' && routine) {
      const name = prompt('Nuovo nome della routine:', routine.name)?.trim();
      if (name) {
        routine.name = name.slice(0, 120);
        routine.updatedAt = new Date().toISOString();
        updateState(state);
        renderHome();
      }
    }
    if (action === 'duplicate' && routine) {
      updateState({ ...state, routines: [...state.routines, cloneRoutine(routine)] });
      renderHome();
      toast('Routine duplicata');
    }
    if (action === 'delete' && routine && confirm(`Eliminare definitivamente “${routine.name}”?`)) {
      updateState({ ...state, routines: state.routines.filter((item) => item.id !== routine.id) });
      renderHome();
    }
    if (action === 'settings') root.querySelector('#settings-dialog').showModal();
    if (action === 'test-sound') {
      void unlockAudio().then((ready) => {
        if (ready) {
          playCue('intermediate', true);
        } else {
          toast('Il browser non ha autorizzato l’audio. Riprova toccando il pulsante.');
        }
      });
    }
    if (action === 'export') {
      downloadJson(state, `ritmo-backup-${new Date().toISOString().slice(0, 10)}.json`);
      toast('Backup esportato');
    }
    if (action === 'reset' && confirm('Ripristinare i dati iniziali? Le routine attuali verranno eliminate.')) {
      state = resetState();
      applyTheme();
      renderHome();
    }
  });

  root.querySelector('#settings-dialog')?.addEventListener('change', (event) => {
    if (event.target.name === 'sound-enabled') state.settings.soundEnabled = event.target.checked;
    if (event.target.name === 'initial-countdown') state.settings.initialCountdown = Number(event.target.value);
    if (event.target.name === 'theme') state.settings.theme = event.target.value;
    if (event.target.id !== 'import-file') updateState(state);
  });
  root.querySelector('#import-file')?.addEventListener('change', importBackup);
}

async function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('Il backup supera il limite di 5 MB.');
    const candidate = sanitizeState(await readJsonFile(file));
    const merge = confirm('Premi OK per UNIRE le routine importate a quelle attuali. Premi Annulla per scegliere se SOSTITUIRE tutto.');
    if (merge) {
      state = mergeState(state, candidate);
    } else if (confirm('Sostituire tutte le routine e le impostazioni attuali con il backup?')) {
      state = replaceState(candidate);
    } else {
      return;
    }
    applyTheme();
    renderHome();
    toast('Backup importato correttamente');
  } catch (error) {
    alert(error.message || 'Importazione non riuscita.');
  }
}

function renderEditor(routine) {
  resetViewRoot();
  const editor = new RoutineEditor(root, routine, {
    onSave: (updated) => {
      const index = state.routines.findIndex((item) => item.id === updated.id);
      if (index < 0) return;
      state.routines[index] = updated;
      updateState(state);
    },
    onBack: () => go('home'),
  });
  editor.mount();
}

function renderPlayer(routine) {
  resetViewRoot();
  activePlayer = new RoutinePlayer(root, routine, state.settings, {
    onExit: () => go('home'),
    onEdit: () => go(`edit/${routine.id}`),
    onRepeat: () => {
      activePlayer?.destroy();
      renderPlayer(routine);
    },
    onSettingsChange: (settings) => {
      state.settings = settings;
      updateState(state);
    },
  });
  activePlayer.mount().catch((error) => {
    console.error(error);
    toast('Impossibile avviare la routine');
  });
}

function renderNotFound() {
  resetViewRoot();
  root.innerHTML = `<main class="shell centered-view"><section class="empty-state"><h1>Routine non trovata</h1><button class="button primary" data-action="home">Torna alle routine</button></section></main>`;
  root.querySelector('[data-action="home"]').addEventListener('click', () => go('home'));
}

function router() {
  const { view, id } = parseRoute();
  const routine = state.routines.find((item) => item.id === id);
  if (view !== 'play') {
    activePlayer?.destroy();
    activePlayer = null;
  }
  if (view === 'home' || !location.hash) return renderHome();
  if (view === 'edit') return routine ? renderEditor(routine) : renderNotFound();
  if (view === 'play') return routine ? renderPlayer(routine) : renderNotFound();
  return renderNotFound();
}

window.addEventListener('hashchange', () => {
  if (activePlayer?.isActive && parseRoute().view !== 'play') {
    if (!confirm('Terminare la routine in corso?')) {
      history.replaceState(null, '', `#/play/${activePlayer.routine.id}`);
      return;
    }
  }
  router();
});

window.addEventListener('beforeunload', (event) => {
  if (activePlayer?.isActive) event.preventDefault();
});

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('./service-worker.js');
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) toast('App aggiornata. La nuova versione è pronta.');
      });
    });
  } catch (error) {
    console.warn('Service worker non registrato.', error);
  }
}

applyTheme();
if (!location.hash) history.replaceState(null, '', '#/home');
router();
registerServiceWorker();
