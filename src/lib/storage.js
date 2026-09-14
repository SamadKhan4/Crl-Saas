// Browser privacy settings can disable storage; authentication must still work in memory.
export function readStorage(kind, key) {
  try {
    return window[kind].getItem(key);
  } catch {
    return null;
  }
}
export function writeStorage(kind, key, value) {
  try {
    value === null ? window[kind].removeItem(key) : window[kind].setItem(key, value);
  } catch {
    /* Session remains usable until reload. */
  }
}
