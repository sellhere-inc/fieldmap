/**
 * A deliberately small local cache wrapper. Browser storage is optional (and
 * can be disabled in private browsing), so callers always receive a fallback.
 * Cached values are scoped to the signed-in account where they contain field
 * data, preventing one person's offline data appearing for another account.
 */
const PREFIX = 'fieldmap:v2:';

function key(name: string, userId?: string): string {
  return PREFIX + (userId ? `user:${encodeURIComponent(userId)}:` : 'device:') + name;
}

export function readLocal<T>(name: string, fallback: T, userId?: string): T {
  try {
    const raw = window.localStorage.getItem(key(name, userId));
    return raw === null ? fallback : JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function hasLocal(name: string, userId?: string): boolean {
  try {
    return window.localStorage.getItem(key(name, userId)) !== null;
  } catch {
    return false;
  }
}

export function writeLocal(name: string, value: unknown, userId?: string): void {
  try {
    window.localStorage.setItem(key(name, userId), JSON.stringify(value));
  } catch {
    // Keep the app usable when storage is full or unavailable.
  }
}

export function removeLocal(name: string, userId?: string): void {
  try {
    window.localStorage.removeItem(key(name, userId));
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}
