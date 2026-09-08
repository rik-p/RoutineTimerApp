export const MAX_STEP_SECONDS = 24 * 60 * 60;

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function toSafeSeconds(value, fallback = 1) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clamp(Math.round(parsed), 1, MAX_STEP_SECONDS) : fallback;
}

export function formatDuration(value) {
  const seconds = Math.max(0, Math.ceil(Number(value) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function totalDuration(routine) {
  return (routine?.steps ?? []).reduce((total, step) => total + toSafeSeconds(step.duration), 0);
}

export function durationBeforeStep(routine, index) {
  return (routine?.steps ?? []).slice(0, index).reduce((total, step) => total + toSafeSeconds(step.duration), 0);
}

export function routineProgress(routine, stepIndex, elapsedStepSeconds) {
  const total = totalDuration(routine);
  if (!total) return 0;
  return clamp((durationBeforeStep(routine, stepIndex) + elapsedStepSeconds) / total, 0, 1);
}

export function countSteps(routine, type) {
  return (routine?.steps ?? []).filter((step) => !type || step.type === type).length;
}

export function formatDate(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function debounce(callback, delay = 450) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => callback(...args), delay);
  };
}

export function downloadJson(data, fileName) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch {
        reject(new Error('Il file non contiene JSON valido.'));
      }
    };
    reader.onerror = () => reject(new Error('Impossibile leggere il file.'));
    reader.readAsText(file);
  });
}
