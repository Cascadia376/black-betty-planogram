/** Deterministic test stand-in for one origin's exclusive Web Locks. */
export function workspaceTestLocks() {
  const tails = new Map<string, Promise<unknown>>();
  return {
    request<T>(name: string, action: () => Promise<T>): Promise<T> {
      const next = (tails.get(name) ?? Promise.resolve()).catch(() => {}).then(action);
      tails.set(name, next);
      return next;
    },
  };
}
