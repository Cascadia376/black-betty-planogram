import { useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";
import type { FloorplanEditState } from "./FloorplanViewport";

function layoutScope(pathname: string, search: string) {
  const params = new URLSearchParams(search);
  return [pathname, ...["layout", "mode", "campaign", "program"].map((key) => params.get(key))].join("|");
}

/** Selection within a map is safe; changing its store/layout or leaving requires a decision. */
export function FloorplanNavigationGuard({ dirty, saving }: FloorplanEditState) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty &&
    layoutScope(currentLocation.pathname, currentLocation.search) !== layoutScope(nextLocation.pathname, nextLocation.search));
  const stay = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (blocker.state === "blocked") {
      if (!dirty) blocker.proceed();
      else stay.current?.focus();
    }
  }, [blocker, dirty]);
  if (blocker.state !== "blocked") return null;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
    <section role="alertdialog" aria-modal="true" aria-labelledby="floorplan-leave-title" aria-describedby="floorplan-leave-message" className="max-w-md space-y-4 rounded border bg-white p-6 shadow-xl" onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); blocker.reset(); }
      if (event.key === "Tab") {
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
        const first = buttons[0]; const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
      <h2 id="floorplan-leave-title" className="text-lg font-semibold">Protect your floorplan change</h2>
      <p id="floorplan-leave-message">{saving ? "A save is in progress. The new page will open after it succeeds. Stay here to review any save error." : "This position has not been saved. Keep editing to save or retry, or explicitly discard it before leaving."}</p>
      <div className="flex flex-wrap gap-3">
        <button ref={stay} type="button" className="rounded border px-3 py-2" onClick={() => blocker.reset()}>Keep editing</button>
        <button type="button" disabled={saving} className="rounded border px-3 py-2 disabled:opacity-50" onClick={() => blocker.proceed()}>Discard unsaved change and leave</button>
      </div>
    </section>
  </div>;
}
