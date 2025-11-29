import { DraftPosterEvent } from "@/lib/api/ai";
import { WordpressEventUpsertPayload } from "@/types/wordpress";

/**
 * Manual event creation uses `assemblePayload` inside
 * `frontend/app/(app)/dashboard/calendar/page.tsx`. This helper mirrors the same
 * field formatting so poster-derived drafts hit the exact same WordPress API
 * contract.
 */
export function buildCreatePayloadFromDraft(
  draft: DraftPosterEvent,
): WordpressEventUpsertPayload {
  const title = draft.title?.trim() || "Untitled event";
  const start = isoToWpDateTime(draft.startDateTime);
  const end = isoToWpDateTime(draft.endDateTime ?? draft.startDateTime);

  return {
    title,
    content: draft.description?.trim() ? draft.description : undefined,
    status: "publish",
    meta: {
      _event_start: start,
      _event_end: end,
      _event_all_day: draft.isAllDay ? "1" : "0",
      _event_location_mode: draft.location ? "custom" : "default",
      _event_location: draft.location ?? "",
      _event_location_id: "0",
      _event_is_recurring: "0",
      _event_rrule: "",
      _event_recurrence_interval: "1",
      _event_recurrence_weekdays: [],
    },
  };
}

function isoToWpDateTime(iso: string) {
  if (!iso) return "";
  const match = iso.match(
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/,
  );
  if (!match) {
    return iso.replace("T", " ").slice(0, 19);
  }
  const [, datePart, hour, minute, seconds] = match;
  return `${datePart} ${hour}:${minute}:${seconds ?? "00"}`;
}

