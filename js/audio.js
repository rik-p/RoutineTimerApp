let context;

function getContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  context ||= new AudioContext();
  return context;
}

export async function unlockAudio() {
  const audioContext = getContext();
  if (audioContext?.state === 'suspended') await audioContext.resume();
}

function tone(frequency, duration = 0.12, delay = 0, volume = 0.12) {
  const audioContext = getContext();
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

export function playCue(kind, enabled = true) {
  if (!enabled) return;
  if (kind === 'countdown') tone(520, 0.1);
  if (kind === 'intermediate') {
    tone(660, 0.13);
    tone(820, 0.16, 0.16);
  }
  if (kind === 'step') tone(760, 0.18);
  if (kind === 'complete') {
    tone(600, 0.16);
    tone(760, 0.16, 0.2);
    tone(940, 0.28, 0.4);
  }
}

