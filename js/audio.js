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

function tone(frequency, duration = 0.12, delay = 0, volume = 0.18, waveform = 'sine') {
  const audioContext = context;
  if (!audioContext || audioContext.state !== 'running') return;
  const start = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = waveform;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function soundOptions(options = {}) {
  return {
    mainCueSound: options.mainCueSound === 'strong' ? 'strong' : 'classic',
    intermediateCueSound: options.intermediateCueSound === 'strong' ? 'strong' : 'classic',
    volume: Math.min(1, Math.max(0, Number(options.soundVolume) / 100 || 1)),
  };
}

export function playCue(kind, enabled = true, stepDurationMs = 180, options = {}) {
  if (!enabled) return;
  const { mainCueSound, intermediateCueSound, volume } = soundOptions(options);
  const mainIsStrong = mainCueSound === 'strong';
  const intermediateIsStrong = intermediateCueSound === 'strong';

  if (kind === 'countdown') tone(mainIsStrong ? 720 : 520, 0.1, 0, (mainIsStrong ? 0.34 : 0.18) * volume, mainIsStrong ? 'triangle' : 'sine');
  if (kind === 'intermediate') {
    if (intermediateIsStrong) {
      tone(920, 0.12, 0, 0.42 * volume, 'triangle');
      tone(1240, 0.18, 0.15, 0.46 * volume, 'triangle');
    } else {
      tone(660, 0.13, 0, 0.18 * volume);
      tone(820, 0.16, 0.16, 0.18 * volume);
    }
  }
  if (kind === 'step') {
    const duration = Math.min(2, Math.max(0.05, Number(stepDurationMs) / 1000 || 0.18));
    tone(mainIsStrong ? 1040 : 760, duration, 0, (mainIsStrong ? 0.48 : 0.18) * volume, mainIsStrong ? 'triangle' : 'sine');
  }
  if (kind === 'complete') {
    const multiplier = mainIsStrong ? 0.42 : 0.18;
    const waveform = mainIsStrong ? 'triangle' : 'sine';
    tone(mainIsStrong ? 760 : 600, 0.16, 0, multiplier * volume, waveform);
    tone(mainIsStrong ? 1040 : 760, 0.16, 0.2, multiplier * volume, waveform);
    tone(mainIsStrong ? 1320 : 940, 0.28, 0.4, multiplier * volume, waveform);
  }
}
