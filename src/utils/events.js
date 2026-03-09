/**
 * Simple pub/sub event bus for cross-component communication.
 */
const bus = new EventTarget();

export const emit = (type, detail) =>
  bus.dispatchEvent(new CustomEvent(type, { detail }));

export const on = (type, fn) => {
  const handler = (e) => fn(e.detail);
  bus.addEventListener(type, handler);
  return () => bus.removeEventListener(type, handler);
};
