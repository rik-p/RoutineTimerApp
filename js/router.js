export function toRouteHash(route) {
  const normalized = String(route || 'home').replace(/^#?\/*/, '');
  return `#/${normalized}`;
}

export function parseRouteHash(hash) {
  const normalized = String(hash || '').replace(/^#?\/*/, '');
  const [view = 'home', encodedId] = normalized.split('/').filter(Boolean);
  let id = encodedId;
  try {
    id = encodedId ? decodeURIComponent(encodedId) : undefined;
  } catch {
    id = encodedId;
  }
  return { view, id };
}

