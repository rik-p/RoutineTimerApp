import { MAX_STEP_SECONDS, clamp, deepClone, toSafeSeconds, uid } from './utils.js';

export const SCHEMA_VERSION = 1;

export function createExercise(overrides = {}) {
  return {
    id: uid(),
    type: 'exercise',
    name: 'Nuovo esercizio',
    duration: 60,
    notes: '',
    intermediateSignals: [],
    ...overrides,
  };
}

export function createPause(overrides = {}) {
  return {
    id: uid(),
    type: 'pause',
    name: 'Pausa',
    duration: 5,
    ...overrides,
  };
}

export function createRoutine(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: uid(),
    name: 'Nuova routine',
    description: '',
    createdAt: now,
    updatedAt: now,
    steps: [],
    ...overrides,
  };
}

function demoExercise(name, duration, signalAt) {
  return createExercise({
    name,
    duration,
    intermediateSignals: signalAt
      ? [{ id: uid(), at: signalAt, label: 'Cambia lato', sound: true }]
      : [],
  });
}

export function createDemoRoutine() {
  return createRoutine({
    name: 'Routine mattutina',
    description: 'Una sequenza dolce per risvegliare e mobilizzare tutto il corpo.',
    steps: [
      demoExercise('Gatto – Mucca', 60),
      demoExercise('Rotazioni toraciche alternate', 60),
      demoExercise('Posizione del bambino', 60),
      demoExercise('Affondo basso', 60, 30),
      demoExercise('Distensione gamba anteriore', 60, 30),
      demoExercise('Farfalla', 60),
      demoExercise('Figura 4 da sdraiato', 120, 60),
      demoExercise('Torsione della colonna', 90, 45),
      demoExercise('Polpaccio alla parete', 60, 30),
      demoExercise('Apertura pettorale alla parete', 60, 30),
      demoExercise('Braccio trasversale', 60, 30),
      demoExercise('Tricipite sopra la testa', 60, 30),
      demoExercise('Inclinazione laterale del collo', 60, 30),
      demoExercise('Rotazioni del collo alternate', 30),
    ],
  });
}

export function createInitialState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    routines: [createDemoRoutine()],
    settings: {
      soundEnabled: true,
      stepTransitionSoundMs: 180,
      initialCountdown: 3,
      theme: 'system',
    },
  };
}

function sanitizeSignal(signal, duration) {
  if (!signal || typeof signal !== 'object') return null;
  const at = Number(signal.at);
  if (!Number.isFinite(at) || at <= 0 || at >= duration) return null;
  return {
    id: typeof signal.id === 'string' ? signal.id : uid(),
    at: Math.round(at),
    label: String(signal.label || 'Segnale').slice(0, 120),
    sound: signal.sound !== false,
  };
}

function sanitizeStep(step) {
  if (!step || typeof step !== 'object' || !['exercise', 'pause'].includes(step.type)) return null;
  const duration = toSafeSeconds(step.duration);
  const base = {
    id: typeof step.id === 'string' ? step.id : uid(),
    type: step.type,
    name: String(step.name || (step.type === 'pause' ? 'Pausa' : 'Esercizio')).slice(0, 120),
    duration,
  };
  if (step.type === 'exercise') {
    base.notes = String(step.notes || '').slice(0, 1000);
    base.intermediateSignals = Array.isArray(step.intermediateSignals)
      ? step.intermediateSignals.map((item) => sanitizeSignal(item, duration)).filter(Boolean).sort((a, b) => a.at - b.at)
      : [];
  }
  return base;
}

function sanitizeRoutine(routine) {
  if (!routine || typeof routine !== 'object' || !Array.isArray(routine.steps)) return null;
  const now = new Date().toISOString();
  return {
    id: typeof routine.id === 'string' ? routine.id : uid(),
    name: String(routine.name || 'Routine senza nome').slice(0, 120),
    description: String(routine.description || '').slice(0, 1000),
    createdAt: typeof routine.createdAt === 'string' ? routine.createdAt : now,
    updatedAt: typeof routine.updatedAt === 'string' ? routine.updatedAt : now,
    steps: routine.steps.map(sanitizeStep).filter(Boolean).slice(0, 500),
  };
}

export function sanitizeState(candidate) {
  if (!candidate || typeof candidate !== 'object' || !Array.isArray(candidate.routines)) {
    throw new Error('Struttura del backup non valida.');
  }
  const importedVersion = Number(candidate.schemaVersion);
  if (!Number.isInteger(importedVersion) || importedVersion < 1 || importedVersion > SCHEMA_VERSION) {
    throw new Error('Versione del backup non supportata.');
  }
  const settings = candidate.settings && typeof candidate.settings === 'object' ? candidate.settings : {};
  return {
    schemaVersion: SCHEMA_VERSION,
    routines: candidate.routines.map(sanitizeRoutine).filter(Boolean).slice(0, 200),
    settings: {
      soundEnabled: settings.soundEnabled !== false,
      stepTransitionSoundMs: clamp(Math.round(Number(settings.stepTransitionSoundMs) || 180), 50, 2000),
      initialCountdown: clamp(Math.round(Number(settings.initialCountdown) || 0), 0, 10),
      theme: ['system', 'light', 'dark'].includes(settings.theme) ? settings.theme : 'system',
    },
  };
}

export function cloneRoutine(routine) {
  const clone = sanitizeRoutine(deepClone(routine));
  const now = new Date().toISOString();
  clone.id = uid();
  clone.name = `${clone.name} — copia`;
  clone.createdAt = now;
  clone.updatedAt = now;
  clone.steps.forEach((step) => {
    step.id = uid();
    step.intermediateSignals?.forEach((signal) => { signal.id = uid(); });
  });
  return clone;
}

export function duplicateStep(step) {
  const clone = sanitizeStep(deepClone(step));
  clone.id = uid();
  clone.intermediateSignals?.forEach((signal) => { signal.id = uid(); });
  return clone;
}

export function normalizeDurationParts(minutes, seconds) {
  const total = (Number(minutes) || 0) * 60 + (Number(seconds) || 0);
  return Math.min(MAX_STEP_SECONDS, Math.max(1, Math.round(total)));
}
