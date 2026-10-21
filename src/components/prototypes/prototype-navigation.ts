import type { PrototypeSummaryDTO } from "../../server/prototypes/prototype.dto";
import type { MouseEvent } from "react";

export function prototypeHistoryHref(
  prototype: Pick<PrototypeSummaryDTO, "id" | "leadId">,
) {
  const id = encodeURIComponent(prototype.id);
  return prototype.leadId
    ? `/leads/${encodeURIComponent(prototype.leadId)}?tab=prototypes&prototype=${id}#prototipos`
    : `/prototipos?prototype=${id}#prototipo-${id}`;
}

export function editorNavigationIntent(
  event: Pick<
    MouseEvent,
    | "button"
    | "ctrlKey"
    | "metaKey"
    | "shiftKey"
    | "altKey"
    | "defaultPrevented"
  >,
  dirty: boolean,
  busy: boolean,
) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey
  )
    return "allow";
  return busy ? "blocked" : dirty ? "confirm" : "allow";
}
