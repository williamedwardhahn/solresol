/**
 * Component lifecycle scope — tracks created components for bulk cleanup.
 * Replaces the manual `if (renderer) { renderer.destroy(); renderer = null; }` pattern.
 */
export function managed() {
  const refs = [];
  return {
    /** Track a component (anything with a destroy() method). Returns the component for chaining. */
    track(component) {
      if (component && typeof component.destroy === 'function') {
        refs.push(component);
      }
      return component;
    },
    /** Destroy all tracked components and clear the list. */
    destroyAll() {
      for (const ref of refs) {
        ref.destroy();
      }
      refs.length = 0;
    },
    /** Number of tracked components. */
    get size() {
      return refs.length;
    },
  };
}
