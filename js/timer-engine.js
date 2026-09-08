export class TimerEngine {
  constructor({ onTick, onComplete }) {
    this.onTick = onTick;
    this.onComplete = onComplete;
    this.status = 'idle';
    this.durationMs = 0;
    this.remainingMs = 0;
    this.endTime = 0;
    this.intervalId = null;
  }

  start(durationSeconds) {
    this.stop();
    this.durationMs = Math.max(1, durationSeconds * 1000);
    this.remainingMs = this.durationMs;
    this.endTime = Date.now() + this.remainingMs;
    this.status = 'running';
    this.intervalId = window.setInterval(() => this.tick(), 125);
    this.tick();
  }

  tick() {
    if (this.status !== 'running') return;
    this.remainingMs = Math.max(0, this.endTime - Date.now());
    this.onTick?.(this.snapshot());
    if (this.remainingMs <= 0) {
      this.clearInterval();
      this.status = 'completed';
      this.onComplete?.();
    }
  }

  pause() {
    if (this.status !== 'running') return;
    this.remainingMs = Math.max(0, this.endTime - Date.now());
    this.status = 'paused';
    this.clearInterval();
    this.onTick?.(this.snapshot());
  }

  resume() {
    if (this.status !== 'paused') return;
    this.endTime = Date.now() + this.remainingMs;
    this.status = 'running';
    this.intervalId = window.setInterval(() => this.tick(), 125);
    this.tick();
  }

  stop() {
    this.clearInterval();
    this.status = 'idle';
  }

  clearInterval() {
    if (this.intervalId) window.clearInterval(this.intervalId);
    this.intervalId = null;
  }

  snapshot() {
    return {
      status: this.status,
      durationMs: this.durationMs,
      remainingMs: this.remainingMs,
      elapsedMs: Math.max(0, this.durationMs - this.remainingMs),
      progress: this.durationMs ? Math.min(1, Math.max(0, 1 - this.remainingMs / this.durationMs)) : 0,
    };
  }
}

