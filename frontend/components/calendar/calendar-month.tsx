"use client"

import { useMemo } from "react"
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CalendarEvent } from "@/lib/events/types"

/**
 * Event implementation reference (per Step 1):
 * - Main event type: `WordpressEventOccurrence` from `frontend/types/wordpress.ts`.
 * - Data fetching: `apiFetch("/wordpress/events")` via React Query inside
 *   `app/(app)/dashboard/calendar/page.tsx`.
 * - Create event flow: `handleCreate(dateStr)` in the same page, which opens the dialog.
 * - Edit event flow: `handleEdit(occurrence)` in the same page, reused here.
 */

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export type CalendarMonthProps = {
  visibleMonth: Date
  events: CalendarEvent[]
  onPrevMonth: () => void
  onNextMonth: () => void
  onCreateEventForDate: (date: Date) => void
  onEditEvent: (eventId: string) => void
}

export function CalendarMonth({
  visibleMonth,
  events,
  onPrevMonth,
  onNextMonth,
  onCreateEventForDate,
  onEditEvent,
}: CalendarMonthProps) {
  const monthLabel = format(visibleMonth, "MMMM yyyy")
  const monthStart = startOfMonth(visibleMonth)
  const monthEnd = endOfMonth(visibleMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  const days = useMemo(() => {
    const allDays: Date[] = []
    let cursor = calendarStart
    while (cursor <= calendarEnd) {
      allDays.push(cursor)
      cursor = addDays(cursor, 1)
    }
    return allDays
  }, [calendarStart, calendarEnd])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    events.forEach((event) => {
      const dateKey = format(new Date(event.startDate), "yyyy-MM-dd")
      if (!map.has(dateKey)) {
        map.set(dateKey, [])
      }
      map.get(dateKey)!.push(event)
    })
    return map
  }, [events])

  return (
    <div className="border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="text-lg font-semibold">{monthLabel}</div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={onPrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={onNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="px-3 py-2 text-center">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-border">
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd")
          const dayEvents = eventsByDate.get(dateKey) ?? []
          const isToday = isSameDay(day, new Date())
          const inMonth = isSameMonth(day, visibleMonth)
          const displayEvents = dayEvents.slice(0, 3)
          const remaining = dayEvents.length - displayEvents.length

          return (
            <div
              key={dateKey}
              className={cn(
                "group relative min-h-[110px] bg-background p-2",
                !inMonth && "bg-muted/40 text-muted-foreground",
                isToday && "ring-1 ring-primary"
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("text-sm font-medium", !inMonth && "text-muted-foreground/70")}>
                  {format(day, "d")}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => onCreateEventForDate(day)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-2 space-y-1">
                {displayEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className={cn(
                      "w-full truncate rounded-full px-2 py-1 text-left text-xs font-medium",
                      event.categoryColor ?? "bg-primary/10 text-primary"
                    )}
                    onClick={() => onEditEvent(event.id)}
                  >
                    {event.title || "(No title)"}
                  </button>
                ))}
                {remaining > 0 && (
                  <div className="text-xs font-medium text-muted-foreground">+{remaining} more</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

