type Entry<V> = { value: V; expiresAt: number };

const stores: Record<string, Map<string, Entry<unknown>>> = {};

function getStore(name: string): Map<string, Entry<unknown>> {
  return (stores[name] ??= new Map());
}

export function cacheGet<V>(name: string, key: string): V | undefined {
  const store = getStore(name);
  const e = store.get(key);
  if (!e) return undefined;
  if (Date.now() > e.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return e.value as V;
}

export function cacheSet<V>(name: string, key: string, value: V, ttlMs: number): void {
  getStore(name).set(key, { value, expiresAt: Date.now() + ttlMs });
}

export async function cacheOr<V>(
  name: string,
  key: string,
  ttlMs: number,
  fn: () => Promise<V>,
): Promise<V> {
  const hit = cacheGet<V>(name, key);
  if (hit !== undefined) return hit;
  const val = await fn();
  cacheSet(name, key, val, ttlMs);
  return val;
}
