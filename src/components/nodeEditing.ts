// Asks a node to enter text-editing mode. ReactFlow mounts node components a render after the
// graph changes, so a node that doesn't exist yet would miss a plain event: the request is kept
// until that node mounts and consumes it.
let pendingEditId: string | null = null;

export const START_EDIT_EVENT = "mm-node-start-edit";

export function requestNodeEdit(id: string) {
  pendingEditId = id;
  window.dispatchEvent(new CustomEvent(START_EDIT_EVENT, { detail: { id } }));
}

/** True (once) if `id` has a pending edit request. */
export function consumePendingEdit(id: string) {
  if (pendingEditId !== id) return false;
  pendingEditId = null;
  return true;
}

/**
 * Focuses a field as soon as it can take focus. ReactFlow renders new nodes with
 * `visibility: hidden` until they are measured, and a hidden element silently refuses focus,
 * so this retries for a few frames. Returns a cancel function.
 */
export function focusWhenReady(
  getField: () => HTMLInputElement | HTMLTextAreaElement | null,
  select = true,
) {
  let frame = 0;
  let handle = 0;
  const attempt = () => {
    const field = getField();
    if (field) {
      field.focus({ preventScroll: true });
      if (document.activeElement === field) {
        if (select) field.select();
        else field.setSelectionRange(field.value.length, field.value.length);
        return;
      }
    }
    if (frame++ < 10) handle = requestAnimationFrame(attempt);
  };
  attempt();
  return () => cancelAnimationFrame(handle);
}
