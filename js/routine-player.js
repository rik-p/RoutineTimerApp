import { playCue } from './audio.js';
import { TimerEngine } from './timer-engine.js';
import { deepClone, escapeHtml, formatDuration, routineProgress, totalDuration } from './utils.js';

export class RoutinePlayer {
  constructor(root, routine, settings, callbacks = {}) {
    this.root = root;
    this.routine = deepClone(routine);
    this.settings = settings;
    this.callbacks = callbacks;
    this.currentStepIndex = 0;
    this.status = 'idle';
    this.firedSignals = new Set();
    this.startedAt = null;
    this.overlayTimeout = null;
    this.countdownTimeout = null;
    this.engine = new TimerEngine({
      onTick: (snapshot) => this.updateTimer(snapshot),
      onComplete: () => this.advanceAutomatically(),
    });
  }

  get isActive() {
    return ['countdown', 'running', 'paused'].includes(this.status);
  }

  async mount() {
    if (!this.routine.steps.length) {
      this.root.innerHTML = this.emptyMarkup();
      this.bindEmpty();
      return;
    }
    this.renderPlayer();
    this.bindControls();
    this.startCountdown();
  }

  emptyMarkup() {
    return `<main class="shell centered-view"><section class="empty-state"><span class="eyebrow">Routine vuota</span><h1>Aggiungi almeno uno step</h1><p>Questa routine non può ancora essere avviata.</p><button class="button primary" data-action="edit">Apri l’editor</button><button class="button ghost" data-action="home">Torna alle routine</button></section></main>`;
  }

  bindEmpty() {
    this.root.querySelector('[data-action="edit"]')?.addEventListener('click', () => this.callbacks.onEdit?.());
    this.root.querySelector('[data-action="home"]')?.addEventListener('click', () => this.callbacks.onExit?.());
  }

  renderPlayer() {
    const step = this.routine.steps[this.currentStepIndex];
    const previous = this.routine.steps[this.currentStepIndex - 1];
    const next = this.routine.steps[this.currentStepIndex + 1];
    this.root.innerHTML = `
      <main class="player-shell">
        <header class="player-header">
          <button class="icon-button subtle" data-action="exit" aria-label="Termina routine">×</button>
          <div><span class="eyebrow">${escapeHtml(this.routine.name)}</span><p id="step-counter">Step ${this.currentStepIndex + 1} di ${this.routine.steps.length}</p></div>
          <button class="icon-button subtle" data-action="sound" aria-label="Attiva o disattiva audio">${this.settings.soundEnabled ? '◖))' : '◖×'}</button>
        </header>
        <section class="routine-progress-wrap" aria-label="Progresso routine">
          <div class="progress-track"><div id="routine-progress" class="progress-fill routine"></div></div>
          <div class="progress-caption"><span id="routine-elapsed">00:00</span><span id="routine-percent">0%</span><span>${formatDuration(totalDuration(this.routine))}</span></div>
        </section>
        <section class="card-stage" aria-label="Sequenza della routine">
          <article id="previous-card" class="player-card side previous" aria-hidden="true">${this.sideCardMarkup(previous)}</article>
          <article id="current-card" class="player-card current">
            ${this.currentCardMarkup(step)}
          </article>
          <article id="next-card" class="player-card side next" aria-hidden="true">${this.sideCardMarkup(next)}</article>
        </section>
        <p id="next-label" class="next-label">${next ? `Prossimo: ${escapeHtml(next.name)} — ${formatDuration(next.duration)}` : 'Ultimo step'}</p>
        <section class="player-controls" aria-label="Controlli timer">
          <button class="control-button secondary" data-action="previous" aria-label="Step precedente"><span aria-hidden="true">↶</span><small>Indietro</small></button>
          <button class="control-button primary-control" data-action="toggle"><span data-toggle-icon aria-hidden="true">Ⅱ</span><small data-toggle-label>Pausa</small></button>
          <button class="control-button secondary" data-action="next" aria-label="Salta al prossimo step"><span aria-hidden="true">↷</span><small>Salta</small></button>
          <button class="restart-button" data-action="restart">Riavvia step</button>
        </section>
        <div id="signal-overlay" class="signal-overlay" role="status" aria-live="assertive" hidden></div>
        <div id="countdown-overlay" class="countdown-overlay" role="status" aria-live="assertive" hidden></div>
        <div class="sr-only" id="player-announcer" aria-live="assertive"></div>
      </main>`;
    this.cacheElements();
  }

  currentCardMarkup(step) {
    return `
      <span id="step-type" class="step-type ${step.type}">${step.type === 'pause' ? 'Pausa' : 'Esercizio'}</span>
      <h1 id="step-name">${escapeHtml(step.name)}</h1>
      <p id="step-notes" class="step-notes">${escapeHtml(step.notes || (step.type === 'pause' ? 'Respira e preparati al prossimo esercizio.' : ''))}</p>
      <div id="timer" class="timer" aria-label="Tempo rimanente">${formatDuration(step.duration)}</div>
      <div class="progress-track step" aria-label="Progresso dello step"><div id="step-progress" class="progress-fill step"></div></div>`;
  }

  sideCardMarkup(step) {
    if (!step) return '<span class="side-empty">Fine</span>';
    return `<span class="step-type ${step.type}">${step.type === 'pause' ? 'Pausa' : 'Esercizio'}</span><h2>${escapeHtml(step.name)}</h2><p>${formatDuration(step.duration)}</p>`;
  }

  cacheElements() {
    this.timerElement = this.root.querySelector('#timer');
    this.stepProgress = this.root.querySelector('#step-progress');
    this.routineProgress = this.root.querySelector('#routine-progress');
    this.routineElapsed = this.root.querySelector('#routine-elapsed');
    this.routinePercent = this.root.querySelector('#routine-percent');
    this.signalOverlay = this.root.querySelector('#signal-overlay');
    this.countdownOverlay = this.root.querySelector('#countdown-overlay');
    this.announcer = this.root.querySelector('#player-announcer');
  }

  bindControls() {
    this.root.addEventListener('click', (event) => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (action === 'toggle') this.togglePause();
      if (action === 'previous') this.goToStep(Math.max(0, this.currentStepIndex - 1));
      if (action === 'next') this.goToStep(this.currentStepIndex + 1);
      if (action === 'restart') this.goToStep(this.currentStepIndex);
      if (action === 'exit') this.requestExit();
      if (action === 'sound') this.toggleSound();
    });
  }

  startCountdown() {
    const seconds = Number(this.settings.initialCountdown) || 0;
    if (!seconds) {
      this.startStep();
      return;
    }
    this.status = 'countdown';
    this.countdownOverlay.hidden = false;
    const endTime = Date.now() + seconds * 1000;
    let lastNumber;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      if (remaining !== lastNumber && remaining > 0) {
        lastNumber = remaining;
        this.countdownOverlay.innerHTML = `<span>Preparati</span><strong>${remaining}</strong>`;
        playCue('countdown', this.settings.soundEnabled);
      }
      if (remaining <= 0) {
        this.countdownOverlay.hidden = true;
        this.startStep();
        return;
      }
      this.countdownTimeout = window.setTimeout(update, 100);
    };
    update();
  }

  startStep() {
    const step = this.routine.steps[this.currentStepIndex];
    if (!step) {
      this.completeRoutine();
      return;
    }
    if (!this.startedAt) this.startedAt = Date.now();
    this.status = 'running';
    this.firedSignals.clear();
    this.announcer.textContent = `${step.type === 'pause' ? 'Pausa' : 'Esercizio'}: ${step.name}`;
    this.engine.start(step.duration);
    this.updateToggleControl();
  }

  updateTimer(snapshot) {
    const step = this.routine.steps[this.currentStepIndex];
    if (!step || !this.timerElement) return;
    const remainingSeconds = snapshot.remainingMs / 1000;
    const elapsedSeconds = snapshot.elapsedMs / 1000;
    this.timerElement.textContent = formatDuration(remainingSeconds);
    this.stepProgress.style.width = `${snapshot.progress * 100}%`;
    const totalProgress = routineProgress(this.routine, this.currentStepIndex, elapsedSeconds);
    this.routineProgress.style.width = `${totalProgress * 100}%`;
    this.routineElapsed.textContent = formatDuration(totalDuration(this.routine) * totalProgress);
    this.routinePercent.textContent = `${Math.round(totalProgress * 100)}%`;
    if (step.type === 'exercise') this.checkSignals(step, elapsedSeconds);
  }

  checkSignals(step, elapsedSeconds) {
    step.intermediateSignals.forEach((signal) => {
      if (elapsedSeconds >= signal.at && !this.firedSignals.has(signal.id)) {
        this.firedSignals.add(signal.id);
        this.showSignal(signal.label);
        playCue('intermediate', this.settings.soundEnabled && signal.sound);
      }
    });
  }

  showSignal(label) {
    clearTimeout(this.overlayTimeout);
    this.signalOverlay.textContent = label;
    this.signalOverlay.hidden = false;
    this.overlayTimeout = window.setTimeout(() => { this.signalOverlay.hidden = true; }, 3000);
  }

  advanceAutomatically() {
    playCue(this.currentStepIndex === this.routine.steps.length - 1 ? 'complete' : 'step', this.settings.soundEnabled);
    this.goToStep(this.currentStepIndex + 1, true);
  }

  goToStep(index, animated = false) {
    clearTimeout(this.countdownTimeout);
    if (this.countdownOverlay) this.countdownOverlay.hidden = true;
    if (index >= this.routine.steps.length) {
      this.completeRoutine();
      return;
    }
    this.engine.stop();
    clearTimeout(this.overlayTimeout);
    this.signalOverlay.hidden = true;
    this.currentStepIndex = Math.max(0, index);
    this.updateCards(animated);
    this.startStep();
  }

  updateCards(animated) {
    const currentCard = this.root.querySelector('#current-card');
    if (animated) currentCard.classList.add('leaving');
    window.setTimeout(() => {
      const step = this.routine.steps[this.currentStepIndex];
      const previous = this.routine.steps[this.currentStepIndex - 1];
      const next = this.routine.steps[this.currentStepIndex + 1];
      currentCard.innerHTML = this.currentCardMarkup(step);
      currentCard.classList.remove('leaving');
      currentCard.classList.add('entering');
      this.root.querySelector('#previous-card').innerHTML = this.sideCardMarkup(previous);
      this.root.querySelector('#next-card').innerHTML = this.sideCardMarkup(next);
      this.root.querySelector('#step-counter').textContent = `Step ${this.currentStepIndex + 1} di ${this.routine.steps.length}`;
      this.root.querySelector('#next-label').textContent = next ? `Prossimo: ${next.name} — ${formatDuration(next.duration)}` : 'Ultimo step';
      this.cacheElements();
      requestAnimationFrame(() => currentCard.classList.remove('entering'));
    }, animated ? 260 : 0);
  }

  togglePause() {
    if (this.status === 'running') {
      this.engine.pause();
      this.status = 'paused';
    } else if (this.status === 'paused') {
      this.engine.resume();
      this.status = 'running';
    }
    this.updateToggleControl();
  }

  updateToggleControl() {
    const paused = this.status === 'paused';
    const icon = this.root.querySelector('[data-toggle-icon]');
    const label = this.root.querySelector('[data-toggle-label]');
    if (icon) icon.textContent = paused ? '▶' : 'Ⅱ';
    if (label) label.textContent = paused ? 'Riprendi' : 'Pausa';
  }

  toggleSound() {
    this.settings.soundEnabled = !this.settings.soundEnabled;
    const button = this.root.querySelector('[data-action="sound"]');
    button.textContent = this.settings.soundEnabled ? '◖))' : '◖×';
    this.callbacks.onSettingsChange?.(this.settings);
  }

  requestExit() {
    if (!this.isActive || confirm('Terminare la routine in corso?')) {
      this.destroy();
      this.callbacks.onExit?.();
    }
  }

  completeRoutine() {
    this.engine.stop();
    this.status = 'completed';
    const actualSeconds = this.startedAt ? (Date.now() - this.startedAt) / 1000 : totalDuration(this.routine);
    this.root.innerHTML = `
      <main class="shell centered-view completion-view">
        <section class="completion-card">
          <div class="completion-mark" aria-hidden="true">✓</div>
          <span class="eyebrow">Routine completata</span>
          <h1>${escapeHtml(this.routine.name)}</h1>
          <div class="completion-stats"><div><strong>${formatDuration(totalDuration(this.routine))}</strong><span>prevista</span></div><div><strong>${formatDuration(actualSeconds)}</strong><span>effettiva</span></div></div>
          <button class="button primary wide" data-action="repeat">Ripeti</button>
          <button class="button ghost wide" data-action="home">Torna alle routine</button>
        </section>
      </main>`;
    this.root.querySelector('[data-action="repeat"]').addEventListener('click', () => this.callbacks.onRepeat?.());
    this.root.querySelector('[data-action="home"]').addEventListener('click', () => this.callbacks.onExit?.());
  }

  destroy() {
    this.engine.stop();
    clearTimeout(this.overlayTimeout);
    clearTimeout(this.countdownTimeout);
    this.status = 'idle';
  }
}
