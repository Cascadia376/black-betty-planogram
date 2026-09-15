# Floorplan editing

Open a store's floorplan and choose **Edit display positions**. Drag a display to move it, then select it and drag its bottom-right handle to resize. Save one hotspot at a time with **Save display position**, or use **Cancel change** to restore its saved geometry. Separate hotspots of a split display can be edited independently. Existing rotation is retained.

Keyboard: focus a display and use arrow keys to move by 0.5% of the map. Shift+arrows resize; Escape cancels the pending edit. The +/− controls zoom from 100% to 400%. Drag the background to pan, or enable **Pan floorplan** to drag anywhere without moving a display. **Fit floorplan** resets zoom and pan only.

Edits use normalized coordinates and are bounded to the map. Zoom/pan never alter saved geometry. Changes are store-wide, not specific to a campaign or layout version, and appear in store execution packs. Product assignments and quantities are unchanged. Source floorplan images and generated seeds are not modified.

Persistence uses the existing browser-local planning repository. This is not multi-user database synchronization. Unsaved changes are lost on page navigation/reload; Save is explicit. A save error retains the draft for retry or cancellation.

## Verification

- Unit tests cover geometry bounds, pan limits, cancellation, and save failure.
- Repository tests cover independent split-display persistence and rejecting invalid section ownership without a partial edit.
- The Chromium test moves, resizes, saves, reloads, cancels, zooms, and pans Crown Isle displays. Run with `npx playwright test tests/e2e/floorplan-editing.spec.ts` (set `E2E_LOCAL_TRANSPORT=1` on the managed host).

Quick acceptance: open Crown Isle, move one display, resize it, Save, reload, and confirm position and size. Make another change and Cancel. Zoom in, enable Pan floorplan, drag the map, then Fit floorplan. Confirm the display's product list and cases have not changed.
