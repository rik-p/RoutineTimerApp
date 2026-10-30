import { createExercise, createPause, duplicateStep, normalizeDurationParts } from './models.js';
import { debounce, durationLabel, formatDuration, isRepetitionStep, deepClone, escapeHtml, uid } from './utils.js';

export class RoutineEditor {
  constructor(root, routine, callbacks = {}, settings = {}) {
    this.settings = settings;
    this.root = root;
    this.routine = deepClone(routine);
    this.callbacks = callbacks;
    this.dragSession = null;
    this.saveSoon = debounce(() => this.save(), 500);
  }

  mount() {
    this.render();
    this.bindEvents();
  }

  render() {
    this.root.innerHTML = `
      <main class="shell editor-shell">
        <header class="topbar">
          <button class="icon-button" data-action="back" aria-label="Torna alle routine">←</button>
          <div class="topbar-title"><span class="eyebrow">Editor routine</span><strong id="editor-title">${escapeHtml(this.routine.name)}</strong></div>
          <span id="save-status" class="save-status" role="status">Salvato</span>
        </header>

        <section class="editor-heading surface">
          <label class="field grow"><span>Nome routine</span><input name="routine-name" maxlength="120" required value="${escapeHtml(this.routine.name)}"></label>
          <label class="field grow"><span>Descrizione <small>opzionale</small></span><textarea name="routine-description" maxlength="1000" rows="2">${escapeHtml(this.routine.description)}</textarea></label>
          <div class="total-badge"><span>Durata totale / stimata</span><strong id="editor-total">${durationLabel(this.routine, this.settings)}</strong></div>
        </section>

        <div class="editor-section-heading"><div><span class="eyebrow">Sequenza</span><h1>I tuoi step</h1></div><span id="step-count" class="step-count">${this.routine.steps.length} step</span></div>
        <section id="step-list" class="step-list" aria-label="Step della routine">
          ${this.routine.steps.map((step, index) => this.stepMarkup(step, index)).join('')}
        </section>
        <p class="sr-only" id="reorder-status" role="status" aria-live="polite"></p>
        <div id="empty-steps" class="empty-steps" ${this.routine.steps.length ? 'hidden' : ''}><p>La sequenza è vuota. Aggiungi il primo step.</p></div>
        <section class="add-actions" aria-label="Aggiungi step">
          <button class="button primary" data-action="add-exercise">+ Esercizio</button>
          <button class="button secondary" data-action="add-pause">+ Pausa</button>
        </section>
      </main>`;
  }

  stepMarkup(step, index) {
    const minutes = Math.floor(step.duration / 60);
    const seconds = step.duration % 60;
    return `
      <article class="edit-step surface" data-step-id="${step.id}">
        <div class="step-toolbar">
          <button class="drag-handle" data-drag-handle aria-label="Trascina per riordinare" title="Trascina per riordinare">⠿</button>
          <span class="step-number">${index + 1}</span>
          <strong class="step-compact-name"></strong>
          <span class="step-compact-duration"></span>
          <span class="step-type ${step.type}">${step.type === 'pause' ? 'Pausa' : 'Esercizio'}</span>
          <div class="step-actions">
            <button class="mini-button" data-action="move-up" aria-label="Sposta su" ${index === 0 ? 'disabled' : ''}>↑</button>
            <button class="mini-button" data-action="move-down" aria-label="Sposta giù" ${index === this.routine.steps.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="mini-button" data-action="duplicate" aria-label="Duplica step">⧉</button>
            <button class="mini-button danger" data-action="delete" aria-label="Elimina step">×</button>
          </div>
        </div>
        <div class="step-fields">
          <label class="field grow"><span>${step.type === 'pause' ? 'Etichetta' : 'Nome esercizio'}</span><input data-field="name" maxlength="120" required value="${escapeHtml(step.name)}"></label>
          ${step.type === 'exercise' ? `<label class="field"><span>Modalit\u00e0</span><select data-field="mode"><option value="timed" ${!isRepetitionStep(step) ? 'selected' : ''}>A tempo</option><option value="repetitions" ${isRepetitionStep(step) ? 'selected' : ''}>A ripetizioni</option></select></label>` : ''}
          ${isRepetitionStep(step) ? `<label class="field"><span>Ripetizioni</span><input data-field="repetitions" type="number" min="1" max="10000" step="1" inputmode="numeric" value="${step.repetitions}"></label>` : `<fieldset class="duration-field"><legend>Durata</legend><label><input data-field="minutes" type="number" min="0" max="1440" inputmode="numeric" value="${minutes}"><span>min</span></label><label><input data-field="seconds" type="number" min="0" max="59" inputmode="numeric" value="${seconds}"><span>sec</span></label></fieldset>`}
          ${step.type === 'exercise' ? `
            <label class="field full"><span>Note <small>opzionali</small></span><textarea data-field="notes" maxlength="1000" rows="2">${escapeHtml(step.notes)}</textarea></label>
            ${!isRepetitionStep(step) ? `<section class="signals-editor full">
              <div class="signals-heading"><div><strong>Segnali intermedi</strong><small>Non interrompono il timer</small></div><button class="text-button" data-action="add-signal">+ Segnale</button></div>
              <div class="signal-list">${step.intermediateSignals.map((signal) => this.signalMarkup(signal)).join('')}</div>
            </section>` : ''}` : ''}
        </div>
      </article>`;
  }

  signalMarkup(signal) {
    return `
      <div class="signal-row" data-signal-id="${signal.id}">
        <label><span class="sr-only">Tempo del segnale in secondi</span><input data-signal-field="at" type="number" min="1" inputmode="numeric" value="${signal.at}"><small>sec</small></label>
        <label class="grow"><span class="sr-only">Testo del segnale</span><input data-signal-field="label" maxlength="120" value="${escapeHtml(signal.label)}" placeholder="Es. Cambia lato"></label>
        <label class="switch"><input data-signal-field="sound" type="checkbox" ${signal.sound ? 'checked' : ''}><span>Suono</span></label>
        <button class="mini-button danger" data-action="delete-signal" aria-label="Elimina segnale">×</button>
      </div>`;
  }

  bindEvents() {
    this.eventController?.abort();
    this.eventController = new AbortController();
    const options = { signal: this.eventController.signal };
    this.root.addEventListener('click', (event) => this.handleClick(event), options);
    this.root.addEventListener('input', (event) => this.handleInput(event), options);
    this.root.addEventListener('change', (event) => this.handleInput(event), options);
    this.bindDragAndDrop();
  }

  handleClick(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    const stepCard = button.closest('[data-step-id]');
    const index = stepCard ? this.routine.steps.findIndex((step) => step.id === stepCard.dataset.stepId) : -1;
    if (action === 'back') {
      this.save();
      this.callbacks.onBack?.();
    }
    if (action === 'add-exercise') this.addStep(createExercise());
    if (action === 'add-pause') this.addStep(createPause());
    if (action === 'move-up' && index > 0) this.moveStep(index, index - 1);
    if (action === 'move-down' && index < this.routine.steps.length - 1) this.moveStep(index, index + 1);
    if (action === 'duplicate' && index >= 0) {
      this.routine.steps.splice(index + 1, 0, duplicateStep(this.routine.steps[index]));
      this.changed(true);
    }
    if (action === 'delete' && index >= 0 && confirm(`Eliminare “${this.routine.steps[index].name}”?`)) {
      this.routine.steps.splice(index, 1);
      this.changed(true);
    }
    if (action === 'add-signal' && index >= 0) {
      const step = this.routine.steps[index];
      if (step.duration < 2) step.duration = 2;
      step.intermediateSignals.push({ id: uid(), at: Math.max(1, Math.floor(step.duration / 2)), label: 'Cambia lato', sound: true });
      this.changed(true);
    }
    if (action === 'delete-signal' && index >= 0) {
      const signalId = button.closest('[data-signal-id]')?.dataset.signalId;
      const step = this.routine.steps[index];
      step.intermediateSignals = step.intermediateSignals.filter((signal) => signal.id !== signalId);
      this.changed(true);
    }
  }

  handleInput(event) {
    const input = event.target;
    if (input.name === 'routine-name') {
      this.routine.name = input.value.trimStart().slice(0, 120) || 'Routine senza nome';
      this.root.querySelector('#editor-title').textContent = this.routine.name;
      this.changed();
      return;
    }
    if (input.name === 'routine-description') {
      this.routine.description = input.value.slice(0, 1000);
      this.changed();
      return;
    }
    const card = input.closest('[data-step-id]');
    if (!card) return;
    const step = this.routine.steps.find((item) => item.id === card.dataset.stepId);
    if (!step) return;
    if (input.dataset.field === 'name') step.name = input.value.trimStart().slice(0, 120) || (step.type === 'pause' ? 'Pausa' : 'Esercizio');
    if (input.dataset.field === 'mode') {
      step.mode = input.value === 'repetitions' ? 'repetitions' : 'timed';
      step.repetitions ||= 10;
      this.changed(true);
      return;
    }
    if (input.dataset.field === 'repetitions') {
      const value = Number(input.value);
      const valid = Number.isInteger(value) && value >= 1 && value <= 10000;
      input.setCustomValidity(valid ? '' : 'Inserisci da 1 a 10000 ripetizioni.');
      if (!valid) return;
      step.repetitions = value;
    }
    if (input.dataset.field === 'notes') step.notes = input.value.slice(0, 1000);
    if (['minutes', 'seconds'].includes(input.dataset.field)) {
      const minutesInput = card.querySelector('[data-field="minutes"]');
      const secondsInput = card.querySelector('[data-field="seconds"]');
      const duration = normalizeDurationParts(minutesInput.value, secondsInput.value);
      step.duration = duration;
      const valid = Number(minutesInput.value) * 60 + Number(secondsInput.value) > 0;
      input.setCustomValidity(valid ? '' : 'La durata deve essere maggiore di zero.');
      step.intermediateSignals = step.intermediateSignals?.filter((signal) => signal.at < duration) ?? [];
    }
    const signalRow = input.closest('[data-signal-id]');
    if (signalRow) {
      const signal = step.intermediateSignals.find((item) => item.id === signalRow.dataset.signalId);
      if (signal) {
        if (input.dataset.signalField === 'at') {
          const at = Math.round(Number(input.value));
          const valid = Number.isFinite(at) && at > 0 && at < step.duration;
          input.setCustomValidity(valid ? '' : `Inserisci un valore tra 1 e ${Math.max(1, step.duration - 1)}.`);
          if (valid) signal.at = at;
        }
        if (input.dataset.signalField === 'label') signal.label = input.value.slice(0, 120) || 'Segnale';
        if (input.dataset.signalField === 'sound') signal.sound = input.checked;
        step.intermediateSignals.sort((a, b) => a.at - b.at);
      }
    }
    this.updateSummary();
    this.changed();
  }

  addStep(step) {
    this.routine.steps.push(step);
    this.changed(true);
    requestAnimationFrame(() => this.root.querySelector(`[data-step-id="${step.id}"] input`)?.focus());
  }

  moveStep(from, to) {
    if (from === to || from < 0 || to < 0) return;
    const [step] = this.routine.steps.splice(from, 1);
    this.routine.steps.splice(to, 0, step);
    this.changed(true);
  }

  changed(rerender = false) {
    this.root.querySelector('#save-status').textContent = 'Modifiche…';
    if (rerender) {
      this.save();
      this.render();
      this.bindEvents();
    } else {
      this.updateSummary();
      this.saveSoon();
    }
  }

  updateSummary() {
    const total = this.root.querySelector('#editor-total');
    if (total) total.textContent = durationLabel(this.routine, this.settings);
  }

  save() {
    this.routine.updatedAt = new Date().toISOString();
    this.callbacks.onSave?.(deepClone(this.routine));
    const status = this.root.querySelector('#save-status');
    if (status) status.textContent = 'Salvato';
  }

  bindDragAndDrop() {
    const list = this.root.querySelector('#step-list');
    const options = { signal: this.eventController.signal };
    list.addEventListener('pointerdown', (event) => {
      const handle = event.target.closest('[data-drag-handle]');
      if (!handle || !event.isPrimary || event.button !== 0 || this.dragSession) return;
      event.preventDefault();
      this.beginDrag(handle.closest('[data-step-id]'), event);
    }, options);
    window.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.dragSession?.pointerId) return;
      event.preventDefault();
      this.dragSession.y = event.clientY;
      this.positionDrag();
    }, { ...options, passive: false });
    window.addEventListener('pointerup', (event) => {
      if (event.pointerId === this.dragSession?.pointerId) this.finishDrag();
    }, options);
    window.addEventListener('pointercancel', (event) => {
      if (event.pointerId === this.dragSession?.pointerId) this.finishDrag(true);
    }, options);
    this.root.addEventListener('lostpointercapture', () => this.finishDrag(true), options);
    window.addEventListener('blur', () => this.finishDrag(true), options);
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.dragSession) {
        event.preventDefault();
        this.finishDrag(true);
      }
    }, options);
    this.eventController.signal.addEventListener('abort', () => this.finishDrag(true), { once: true });
  }

  beginDrag(card, event) {
    const list = card.parentElement;
    const oldTop = card.getBoundingClientRect().top;
    // Read from the current model so names and repetition counts include unsaved edits.
    list.querySelectorAll('[data-step-id]').forEach((row) => {
      const step = this.routine.steps.find((item) => item.id === row.dataset.stepId);
      row.querySelector('.step-compact-name').textContent = step.name;
      row.querySelector('.step-compact-duration').textContent = isRepetitionStep(step)
        ? `${step.repetitions} rip.` : formatDuration(step.duration);
    });
    document.body.classList.add('routine-dragging');
    list.classList.add('is-sorting');
    window.scrollBy(0, card.getBoundingClientRect().top - oldTop);
    const preview = card.cloneNode(true);
    preview.removeAttribute('data-step-id');
    preview.classList.add('drag-preview');
    preview.setAttribute('aria-hidden', 'true');
    preview.inert = true;
    const bounds = card.getBoundingClientRect();
    preview.style.width = `${bounds.width}px`;
    preview.style.left = `${bounds.left}px`;
    document.body.append(preview);
    card.classList.add('drag-placeholder');
    this.dragSession = { card, list, preview, pointerId: event.pointerId, y: event.clientY, moved: false };
    this.root.setPointerCapture(event.pointerId);
    this.positionDrag(false);
    this.root.querySelector('#reorder-status').textContent = 'Trascina lo step nella nuova posizione. Esc per annullare.';
    const autoScroll = () => {
      const drag = this.dragSession;
      if (!drag) return;
      const edge = 72;
      const direction = drag.y < edge ? -1 : drag.y > window.innerHeight - edge ? 1 : 0;
      if (direction) {
        const distance = direction < 0 ? edge - drag.y : drag.y - (window.innerHeight - edge);
        window.scrollBy(0, direction * Math.min(18, Math.max(2, distance / 4)));
        this.positionDrag(drag.moved);
      }
      this.dragFrame = requestAnimationFrame(autoScroll);
    };
    this.dragFrame = requestAnimationFrame(autoScroll);
  }

  positionDrag(reorder = true) {
    const drag = this.dragSession;
    if (!drag) return;
    drag.preview.style.top = `${drag.y - drag.preview.getBoundingClientRect().height / 2}px`;
    if (!reorder) return;
    drag.moved = true;
    const rows = [...drag.list.querySelectorAll('[data-step-id]')].filter((row) => row !== drag.card);
    const next = rows.find((row) => {
      const bounds = row.getBoundingClientRect();
      return drag.y < bounds.top + bounds.height / 2;
    });
    if (drag.card.nextElementSibling !== (next ?? null)) {
      drag.list.insertBefore(drag.card, next ?? null);
      this.updateStepPositions();
    }
  }

  updateStepPositions() {
    const rows = [...this.root.querySelectorAll('#step-list > [data-step-id]')];
    rows.forEach((row, index) => {
      row.querySelector('.step-number').textContent = index + 1;
      row.querySelector('[data-action="move-up"]').disabled = index === 0;
      row.querySelector('[data-action="move-down"]').disabled = index === rows.length - 1;
    });
  }

  finishDrag(cancelled = false) {
    const drag = this.dragSession;
    if (!drag) return;
    this.dragSession = null;
    cancelAnimationFrame(this.dragFrame);
    if (this.root.hasPointerCapture(drag.pointerId)) this.root.releasePointerCapture(drag.pointerId);
    const rows = [...drag.list.querySelectorAll('[data-step-id]')];
    const steps = new Map(this.routine.steps.map((step) => [step.id, step]));
    const reordered = rows.some((row, index) => row.dataset.stepId !== this.routine.steps[index].id);
    if (cancelled) {
      const cards = new Map(rows.map((row) => [row.dataset.stepId, row]));
      this.routine.steps.forEach((step) => drag.list.append(cards.get(step.id)));
    } else if (reordered) {
      this.routine.steps = rows.map((row) => steps.get(row.dataset.stepId));
      this.save();
    }
    drag.preview.remove();
    drag.card.classList.remove('drag-placeholder');
    drag.list.classList.remove('is-sorting');
    this.updateStepPositions();
    const handle = drag.card.querySelector('[data-drag-handle]');
    handle.focus({ preventScroll: true });
    handle.scrollIntoView({ block: 'nearest' });
    document.body.classList.remove('routine-dragging');
    this.root.querySelector('#reorder-status').textContent = cancelled ? 'Spostamento annullato.' : 'Ordine degli step salvato.';
  }
}
