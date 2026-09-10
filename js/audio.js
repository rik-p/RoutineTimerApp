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

function tone(frequency, duration = 0.12, delay = 0, volume = 0.18, waveform = 'sine', steady = false) {
  const audioContext = context;
  if (!audioContext || audioContext.state !== 'running') return;
  const start = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = waveform;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  if (steady) {
    gain.gain.setValueAtTime(volume, start + Math.max(0.016, duration - 0.015));
  }
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function soundOptions(options = {}) {
  return {
    mainCueSound: ['classic', 'strong', 'steady'].includes(options.mainCueSound) ? options.mainCueSound : 'classic',
    intermediateCueSound: ['classic', 'strong', 'steady'].includes(options.intermediateCueSound) ? options.intermediateCueSound : 'classic',
    volume: Math.min(1, Math.max(0, Number(options.soundVolume) / 100 || 1)),
  };
}

export function playCue(kind, enabled = true, stepDurationMs = 180, options = {}) {
  if (!enabled) return;
  const { mainCueSound, intermediateCueSound, volume } = soundOptions(options);
  const mainIsStrong = mainCueSound === 'strong';
  const intermediateIsStrong = intermediateCueSound === 'strong';
  const mainIsSteady = mainCueSound === 'steady';
  const intermediateIsSteady = intermediateCueSound === 'steady';

  if (kind === 'countdown') {
    const decided = mainIsStrong || mainIsSteady;
    tone(decided ? 880 : 520, 0.1, 0, (decided ? 0.34 : 0.18) * volume, decided ? 'triangle' : 'sine', mainIsSteady);
  }
  if (kind === 'intermediate') {
    if (intermediateIsStrong || intermediateIsSteady) {
      const steady = intermediateIsSteady;
      tone(1040, 0.18, 0, 0.48 * volume, 'triangle', steady);
    } else {
      tone(660, 0.13, 0, 0.18 * volume);
      tone(820, 0.16, 0.16, 0.18 * volume);
    }
  }
  if (kind === 'step') {
    const duration = Math.min(2, Math.max(0.05, Number(stepDurationMs) / 1000 || 0.18));
    const decided = mainIsStrong || mainIsSteady;
    if (decided) {
      tone(880, Math.min(duration, 0.13), 0, 0.46 * volume, 'triangle', mainIsSteady);
      tone(1160, Math.min(duration, 0.16), 0.15, 0.46 * volume, 'triangle', mainIsSteady);
    } else {
      tone(760, duration, 0, 0.18 * volume);
    }
  }
  if (kind === 'complete') {
    const decided = mainIsStrong || mainIsSteady;
    const multiplier = decided ? 0.42 : 0.18;
    const waveform = decided ? 'triangle' : 'sine';
    const steady = mainIsSteady;
    tone(decided ? 880 : 600, 0.16, 0, multiplier * volume, waveform, steady);
    tone(decided ? 1160 : 760, 0.16, 0.2, multiplier * volume, waveform, steady);
    tone(decided ? 1440 : 940, 0.28, 0.4, multiplier * volume, waveform, steady);
  }
}
