# Floorplan editing and recovery

Current behaviour: September 2026 hardening branch. The canonical physical layout is distinct from the campaign's choice of display location. [Architecture](ADR-0002-reliability-and-release-boundaries.md).

## Edit a store

1. Open **Stores -> Floorplan** and the current layout. Choose **Edit display positions**.
2. Select a promotional display. Drag it to move; drag its bottom-right handle to resize. The marker follows immediately and saves on pointer release. Split-display hotspots have their own geometry and remain part of the same logical display.
3. Wait for **Floorplan saved** before leaving. Select another display to continue. Reopen the store to confirm its saved position.

Mouse, touch and pen use the same primary-pointer path. A cancelled pointer gesture or Escape restores the prior position without saving. Other simultaneous pointers do not steal the edit. Pointer capture prevents a drag from being lost merely because it leaves the marker.

Keyboard: Tab to a marker. Arrows move by 0.5% of the map; Shift+arrows resize. The resize handle accepts arrow resizing directly. Keyboard edits show unsaved state and use **Save floorplan**. Escape or **Cancel change** restores saved geometry. **Undo last saved change** performs one explicit reverse save; it is not a multi-step history editor.

Optional grid snapping uses the same 0.5% step. Overlap warnings are informational: layouts may intentionally have adjacent/overlapping source markers. They do not certify aisle widths, accessibility or store safety. Positions and sizes stay within normalized map bounds. Existing rotation is retained; no new rotation tool or collision engine was introduced.

Zoom/pan affect only the viewport. Fit floorplan resets them without changing the physical data. Read-only unzoomed views permit vertical touch scrolling.

## Save and conflict behaviour

- Local demo: the complete compressed browser snapshot is committed atomically through one localStorage item. A failed write restores the repository's last committed state. The editor still shows its unsaved draft, with retry/cancel controls.
- Shared mode: buyers/admins with existing RLS authorization write only the physical document, using its last-read version. A concurrent buyer edit yields a conflict instead of an overwrite. Planning data is not included in this write.
- A geometry edit also supplies the base geometry it was edited from. It cannot silently replace a newer position already loaded into the current repository.
- Navigation to another store/layout or away from the editor prompts to keep editing or discard unsaved work. A pending save disables discard until it resolves. Browser reload/close uses the browser's unsaved-change warning.
- On a conflict, do not repeatedly retry over another user's changes. Keep any necessary notes, reload the latest map, inspect the updated position, then make a deliberate new edit. No automatic overwrite/rebase is offered.

Category-space draft versions do not own promotional positions. The display editor is hidden on category drafts, campaign/program views and forced campaign `mode=layout` URLs. Physical editing does not change product assignments, quantities or previously frozen release geometry.

## Verification

`tests/e2e/floorplan-editing.spec.ts` exercises drag, resize, pointer cancellation, mouse/touch, keyboard, quota failure, retry, one-step Undo, unsaved navigation, zoom/pan and reload using Crown Isle. Repository and adapter tests cover split-section ownership, finite bounds, stale geometry, cross-tab detection and competing shared physical writes. All mutation tests use isolated local/fake state; see the current [verification record](HARDENING_RUN_2026-09-21.md).
