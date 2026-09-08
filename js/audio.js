let context;

function getAudioContextConstructor() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  return AudioContext || null;
}

export async function unlockAudio() {
  const AudioContext = getAudioContextConstructor();
  if (!AudioContext) return false;
  try {
    if (!context || context.state === 'closed') context = new AudioContext();
    const audioContext = context;
    if (audioContext.state === 'suspended') await audioContext.resume();
    if (audioContext.state === 'interrupted') await audioContext.resume();
    return audioContext.state === 'running';
  } catch (error) {
    console.warn('Audio non disponibile in questo momento.', error);
    return false;
  }
}

function tone(frequency, duration = 0.12, delay = 0, volume = 0.18) {
  const audioContext = context;
  if (!audioContext || audioContext.state !== 'running') return;
  const start = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

export function playCue(kind, enabled = true, stepDurationMs = 180) {
  if (!enabled) return;
  if (kind === 'countdown') tone(520, 0.1);
  if (kind === 'intermediate') {
    tone(660, 0.13);
    tone(820, 0.16, 0.16);
  }
  if (kind === 'step') {
    const duration = Math.min(2, Math.max(0.05, Number(stepDurationMs) / 1000 || 0.18));
    tone(760, duration);
  }
  if (kind === 'complete') {
    tone(600, 0.16);
    tone(760, 0.16, 0.2);
    tone(940, 0.28, 0.4);
  }
}
