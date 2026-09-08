let currentRoot;

class ElementStub {
  constructor(isAppRoot = false) {
    this.isAppRoot = isAppRoot;
    this.dataset = {};
    this.innerHTML = '';
    this.listeners = {};
  }

  cloneNode() { return new ElementStub(this.isAppRoot); }
  replaceWith(replacement) { if (this.isAppRoot) currentRoot = replacement; }
  addEventListener(type, callback) { this.listeners[type] = callback; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  append() {}
}

const appRoot = new ElementStub(true);
currentRoot = appRoot;
const toastRoot = new ElementStub();
globalThis.document = {
  documentElement: new ElementStub(),
  querySelector: (selector) => selector === '#app' ? currentRoot : toastRoot,
  createElement: () => new ElementStub(),
};
globalThis.localStorage = {
  values: new Map(),
  getItem(key) { return this.values.get(key) ?? null; },
  setItem(key, value) { this.values.set(key, value); },
  removeItem(key) { this.values.delete(key); },
};
globalThis.location = { hash: '#/home' };
globalThis.history = { replaceState() {} };
globalThis.navigator = {};
globalThis.window = { addEventListener() {} };
globalThis.setTimeout = () => 1;
globalThis.confirm = () => true;

await import('../js/app.js');
assertMarkup();
assertCreateRoute();
print('Avvio applicazione con DOM simulato: OK');

function assertMarkup() {
  const renderedRoot = document.querySelector('#app');
  if (!renderedRoot.innerHTML.includes('Ritmo')) throw new Error('La home non è stata renderizzata.');
  if (!renderedRoot.innerHTML.includes('Routine mattutina')) throw new Error('La routine demo non è visibile.');
}

function assertCreateRoute() {
  const event = {
    target: {
      closest: (selector) => selector === '[data-action]' ? { dataset: { action: 'create' }, closest: () => null } : null,
    },
  };
  document.querySelector('#app').listeners.click(event);
  if (!location.hash.startsWith('/edit/')) throw new Error('La creazione deve usare una route editor valida.');
}
