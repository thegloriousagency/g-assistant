import { WordpressEventOccurrence } from "@/types/wordpress"

/**
 * Shared calendar event shape reused by month/list views.
 * Acts as a light wrapper around `WordpressEventOccurrence`.
 */
export type CalendarEvent = {
  id: string
  title: string
  startDate: string
  endDate?: string | null
  categoryColor?: string | null
  /**
   * Reference to the underlying WordPress occurrence so callers
   * can drill back into full metadata when needed.
   */
  source?: WordpressEventOccurrence
}

