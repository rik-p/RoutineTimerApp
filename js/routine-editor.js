import { createExercise, createPause, duplicateStep, normalizeDurationParts } from './models.js';
import { debounce, deepClone, escapeHtml, formatDuration, totalDuration, uid } from './utils.js';

export class RoutineEditor {
  constructor(root, routine, callbacks = {}) {
    this.root = root;
    this.routine = deepClone(routine);
    this.callbacks = callbacks;
    this.draggedId = null;
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
          <div class="total-badge"><span>Durata totale</span><strong id="editor-total">${formatDuration(totalDuration(this.routine))}</strong></div>
        </section>

        <div class="editor-section-heading"><div><span class="eyebrow">Sequenza</span><h1>I tuoi step</h1></div><span id="step-count" class="step-count">${this.routine.steps.length} step</span></div>
        <section id="step-list" class="step-list" aria-label="Step della routine">
          ${this.routine.steps.map((step, index) => this.stepMarkup(step, index)).join('')}
        </section>
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
          <button class="drag-handle" data-drag-handle draggable="true" aria-label="Trascina per riordinare" title="Trascina per riordinare">⠿</button>
          <span class="step-number">${index + 1}</span>
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
          <fieldset class="duration-field"><legend>Durata</legend><label><input data-field="minutes" type="number" min="0" max="1440" inputmode="numeric" value="${minutes}"><span>min</span></label><label><input data-field="seconds" type="number" min="0" max="59" inputmode="numeric" value="${seconds}"><span>sec</span></label></fieldset>
          ${step.type === 'exercise' ? `
            <label class="field full"><span>Note <small>opzionali</small></span><textarea data-field="notes" maxlength="1000" rows="2">${escapeHtml(step.notes)}</textarea></label>
            <section class="signals-editor full">
              <div class="signals-heading"><div><strong>Segnali intermedi</strong><small>Non interrompono il timer</small></div><button class="text-button" data-action="add-signal">+ Segnale</button></div>
              <div class="signal-list">${step.intermediateSignals.map((signal) => this.signalMarkup(signal)).join('')}</div>
            </section>` : ''}
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
    if (total) total.textContent = formatDuration(totalDuration(this.routine));
  }

  save() {
    this.routine.updatedAt = new Date().toISOString();
    this.callbacks.onSave?.(deepClone(this.routine));
    const status = this.root.querySelector('#save-status');
    if (status) status.textContent = 'Salvato';
  }

  bindDragAndDrop() {
    const list = this.root.querySelector('#step-list');
    list.addEventListener('dragstart', (event) => {
      const card = event.target.closest('[data-step-id]');
      if (!card) return;
      this.draggedId = card.dataset.stepId;
      card.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'move';
    });
    list.addEventListener('dragend', (event) => event.target.closest('[data-step-id]')?.classList.remove('dragging'));
    list.addEventListener('dragover', (event) => event.preventDefault());
    list.addEventListener('drop', (event) => {
      event.preventDefault();
      const target = event.target.closest('[data-step-id]');
      this.reorderByIds(this.draggedId, target?.dataset.stepId);
    });

    list.querySelectorAll('[data-drag-handle]').forEach((handle) => {
      handle.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse') return;
        event.preventDefault();
        const card = handle.closest('[data-step-id]');
        this.draggedId = card.dataset.stepId;
        card.classList.add('dragging');
        handle.setPointerCapture(event.pointerId);
      });
      handle.addEventListener('pointerup', (event) => {
        if (!this.draggedId) return;
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-step-id]');
        this.root.querySelector(`[data-step-id="${this.draggedId}"]`)?.classList.remove('dragging');
        this.reorderByIds(this.draggedId, target?.dataset.stepId);
        this.draggedId = null;
      });
    });
  }

  reorderByIds(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const from = this.routine.steps.findIndex((step) => step.id === sourceId);
    const to = this.routine.steps.findIndex((step) => step.id === targetId);
    this.moveStep(from, to);
  }
}
