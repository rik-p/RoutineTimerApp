let started = 0;

class FakeAudioContext {
  constructor() {
    this.state = 'suspended';
    this.currentTime = 0;
  }

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }

  createOscillator() {
    return {
      frequency: { setValueAtTime() {} },
      connect() { return this; },
      start() { started += 1; },
      stop() {},
    };
  }

  createGain() {
    return {
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() { return this; },
    };
  }
}

globalThis.window = { AudioContext: FakeAudioContext };
const { playCue, unlockAudio } = await import('../js/audio.js');

if (!await unlockAudio()) throw new Error('L’audio deve essere sbloccato da un gesto utente.');
playCue('intermediate');
if (started !== 2) throw new Error('Il segnale intermedio deve emettere due beep.');
print('Smoke test audio: OK');
