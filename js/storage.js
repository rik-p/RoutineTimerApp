import { SCHEMA_VERSION, createInitialState, sanitizeState } from './models.js';
import { deepClone, uid } from './utils.js';

const STORAGE_KEY = 'ritmo:routine-timer:v1';
let memoryFallback = null;

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createInitialState();
      saveState(initial);
      return initial;
    }
    return sanitizeState(JSON.parse(raw));
  } catch (error) {
    console.warn('Dati locali non leggibili; uso un ripristino sicuro.', error);
    if (memoryFallback) return deepClone(memoryFallback);
    const initial = createInitialState();
    try {
      localStorage.setItem(`${STORAGE_KEY}:corrupt:${Date.now()}`, localStorage.getItem(STORAGE_KEY) || '');
    } catch {
      // Lo storage può essere disabilitato: l'app resta utilizzabile in memoria.
    }
    saveState(initial);
    return initial;
  }
}

export function saveState(candidate) {
  const state = sanitizeState(candidate);
  state.schemaVersion = SCHEMA_VERSION;
  memoryFallback = deepClone(state);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Salvataggio locale non disponibile.', error);
  }
  return state;
}

export function replaceState(candidate) {
  return saveState(sanitizeState(candidate));
}

export function mergeState(current, imported) {
  const clean = sanitizeState(imported);
  const existingIds = new Set(current.routines.map((routine) => routine.id));
  clean.routines.forEach((routine) => {
    if (existingIds.has(routine.id)) routine.id = uid();
  });
  return saveState({
    ...current,
    routines: [...current.routines, ...clean.routines],
  });
}

export function resetState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Il successivo caricamento usa comunque lo stato iniziale in memoria.
  }
  memoryFallback = null;
  return loadState();
}

export { STORAGE_KEY };
