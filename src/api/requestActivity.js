let pendingRequests = 0;
const listeners = new Set();
export const getPendingRequests = () => pendingRequests;
export function subscribeToRequests(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function startRequest() {
  pendingRequests += 1;
  listeners.forEach((listener) => listener());
}
export function finishRequest() {
  pendingRequests = Math.max(0, pendingRequests - 1);
  listeners.forEach((listener) => listener());
}
