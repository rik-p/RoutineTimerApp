import { createDemoRoutine, createInitialState, sanitizeState } from '../js/models.js';
import { loadState, saveState } from '../js/storage.js';
import { TimerEngine } from '../js/timer-engine.js';
import { parseRouteHash, toRouteHash } from '../js/router.js';
import { formatDuration, routineProgress, totalDuration } from '../js/utils.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const demo = createDemoRoutine();
assert(demo.steps.length === 14, 'La demo deve avere 14 step.');
assert(totalDuration(demo) === 900, 'La demo deve durare 15 minuti.');
assert(formatDuration(3661) === '1:01:01', 'Formato durata oltre un’ora non valido.');
assert(routineProgress(demo, 1, 0) === 60 / 900, 'Il progresso deve essere pesato sul tempo.');
assert(sanitizeState({ schemaVersion: 1, routines: [demo], settings: {} }).routines.length === 1, 'Sanitizzazione non valida.');
assert(sanitizeState({ schemaVersion: 1, routines: [], settings: { stepTransitionSoundMs: 9000 } }).settings.stepTransitionSoundMs === 2000, 'La durata suono deve rispettare il massimo.');
const soundSettings = sanitizeState({ schemaVersion: 1, routines: [], settings: { soundVolume: 250, mainCueSound: 'strong', intermediateCueSound: 'strong' } }).settings;
assert(soundSettings.soundVolume === 100 && soundSettings.mainCueSound === 'strong' && soundSettings.intermediateCueSound === 'strong', 'Le preferenze audio non vengono salvate correttamente.');
assert(sanitizeState({ schemaVersion: 1, routines: [], settings: { soundVolume: 0 } }).settings.soundVolume === 10, 'Il volume deve rispettare il minimo.');
let rejectedInvalidBackup = false;
try {
  sanitizeState({ routines: [] });
} catch {
  rejectedInvalidBackup = true;
}
assert(rejectedInvalidBackup, 'Un backup senza versione deve essere rifiutato.');
assert(toRouteHash('edit/abc') === '#/edit/abc', 'La route generata non è valida.');
assert(parseRouteHash('#/edit/abc').id === 'abc', 'La route standard non viene letta.');
assert(parseRouteHash('#edit/abc').id === 'abc', 'La vecchia route non è retrocompatibile.');

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};
const initial = createInitialState();
saveState(initial);
assert(loadState().routines.length === 1, 'Persistenza locale non valida.');

let now = 1000;
Date.now = () => now;
globalThis.window = { setInterval: () => 1, clearInterval: () => {} };
let completed = 0;
const engine = new TimerEngine({ onComplete: () => { completed += 1; } });
engine.start(2);
now = 2000;
engine.tick();
assert(engine.snapshot().remainingMs === 1000, 'Il timer non usa correttamente i timestamp.');
engine.pause();
now = 5000;
engine.resume();
now = 6000;
engine.tick();
assert(completed === 1, 'Il timer deve completarsi una sola volta.');

print('Smoke test JavaScript: OK');
