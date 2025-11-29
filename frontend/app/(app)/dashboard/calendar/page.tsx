"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch, ApiError } from "@/lib/api-client";
import type {
  WordpressEventDetail,
  WordpressEventsResponse,
  WordpressEventOccurrence,
  WordpressEventUpsertPayload,
  WordpressMetaPrimitive,
  WordpressLocation,
  WordpressCecSettings,
} from "@/types/wordpress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, ChevronDownIcon } from "lucide-react";
import { addMonths, endOfMonth, format, parse, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarMonth } from "@/components/calendar/calendar-month";
import { CalendarEvent } from "@/lib/events/types";

type EventFormState = {
  title: string;
  description: string;
  allDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  locationMode: "default" | "saved" | "custom";
  locationSavedId: number;
  locationCustomText: string;
  // Recurrence
  isRecurring: boolean;
  recurrenceInterval: number;
  recurrenceFrequency: "daily" | "weekly" | "monthly";
  recurrenceWeekdays: string[];
  recurrenceEndType: "never" | "count" | "until";
  recurrenceEndCount: number;
  recurrenceEndDate: string;
};

const DEFAULT_START_TIME = "09:00";
const DEFAULT_END_TIME = "10:00";
const HOURS_12 = ["12", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11"];
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => index.toString().padStart(2, "0"));
const PERIOD_OPTIONS: Array<"AM" | "PM"> = ["AM", "PM"];

const WEEKDAY_MAP: Record<string, string> = {
  MO: "monday",
  TU: "tuesday",
  WE: "wednesday",
  TH: "thursday",
  FR: "friday",
  SA: "saturday",
  SU: "sunday",
};

const WEEKDAY_REVERSE_MAP: Record<string, string> = {
  monday: "MO",
  tuesday: "TU",
  wednesday: "WE",
  thursday: "TH",
  friday: "FR",
  saturday: "SA",
  sunday: "SU",
};

function buildDefaultForm(range: { start: string; end: string }): EventFormState {
  return {
    title: "",
    description: "",
    allDay: false,
    startDate: range.start,
    startTime: DEFAULT_START_TIME,
    endDate: range.start,
    endTime: DEFAULT_END_TIME,
    locationMode: "default",
    locationSavedId: 0,
    locationCustomText: "",
    isRecurring: false,
    recurrenceInterval: 1,
    recurrenceFrequency: "weekly",
    recurrenceWeekdays: [],
    recurrenceEndType: "never",
    recurrenceEndCount: 1,
    recurrenceEndDate: "",
  };
}

function parseInputsToDate(date: string, time: string) {
  return new Date(`${date}T${time || "00:00"}:00`);
}

function normalizeTimeValue(time: string | undefined, fallback: string) {
  if (!time) return fallback;
  if (time.length >= 5) {
    return time.slice(0, 5);
  }
  return fallback;
}

function composeMetaDateTime(date: string, time: string) {
  const normalizedDate = date || "";
  const normalizedTime = normalizeTimeValue(time, DEFAULT_START_TIME);
  return `${normalizedDate} ${normalizedTime}:00`.trim();
}

function sanitizeOccurrenceIso(isoString: string) {
  if (!isoString) return null;
  const withoutOffset = isoString.replace(/([+-]\d{2}:\d{2}|Z)$/i, "");
  const [datePart, timePartRaw] = withoutOffset.split("T");
  if (!datePart) return null;
  const timePart = timePartRaw?.slice(0, 5) ?? DEFAULT_START_TIME;
  return { date: datePart, time: timePart };
}

function parseOccurrenceToDate(isoString: string) {
  const parts = sanitizeOccurrenceIso(isoString);
  if (!parts) return null;
  return new Date(`${parts.date}T${parts.time}:00`);
}

function buildFormFromOccurrence(
  occurrence: WordpressEventOccurrence,
  fallbackRange: { start: string; end: string },
): EventFormState {
  const startParts = sanitizeOccurrenceIso(occurrence.start);
  const endParts = sanitizeOccurrenceIso(occurrence.end);
  const base = buildDefaultForm(fallbackRange);
  
  if (!startParts || !endParts) {
    return base;
  }
  
  const mode = (occurrence.location_mode as "default" | "saved" | "custom") || "default";
  
  return {
    ...base,
    title: occurrence.title || "",
    description: "",
    allDay: Boolean(occurrence.all_day),
    startDate: startParts.date,
    startTime: startParts.time,
    endDate: endParts.date,
    endTime: endParts.time,
    locationMode: mode,
    locationSavedId: occurrence.location_id || 0,
    locationCustomText: mode === "custom" ? occurrence.location || "" : "",
  };
}

function coerceMetaString(meta: Record<string, unknown> | undefined, key: string) {
  const value = meta?.[key];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  if (value == null) {
    return "";
  }
  return String(value);
}

function parseRRuleToState(rrule: string) {
  const state = {
    frequency: "weekly" as "daily" | "weekly" | "monthly",
    interval: 1,
    weekdays: [] as string[],
    endType: "never" as "never" | "count" | "until",
    endCount: 1,
    endDate: "",
  };
  if (!rrule) return state;
  
  const parts = rrule.split(";");
  for (const part of parts) {
    const [key, val] = part.split("=");
    if (!key || !val) continue;
    
    if (key === "FREQ") state.frequency = val.toLowerCase() as any;
    if (key === "INTERVAL") state.interval = parseInt(val, 10) || 1;
    if (key === "BYDAY") {
      state.weekdays = val.split(",").map(d => WEEKDAY_MAP[d] || "").filter(Boolean);
    }
    if (key === "COUNT") {
      state.endType = "count";
      state.endCount = parseInt(val, 10) || 1;
    }
    if (key === "UNTIL") {
      state.endType = "until";
      // UNTIL=YYYYMMDDTHHMMSSZ. Parse to YYYY-MM-DD.
      if (val.length >= 8) {
        state.endDate = `${val.slice(0,4)}-${val.slice(4,6)}-${val.slice(6,8)}`;
      }
    }
  }
  return state;
}

function buildRRule(state: EventFormState) {
  if (!state.isRecurring) return "";
  
  const parts: string[] = [];
  parts.push(`FREQ=${state.recurrenceFrequency.toUpperCase()}`);
  parts.push(`INTERVAL=${Math.max(1, state.recurrenceInterval)}`);
  
  if (state.recurrenceFrequency === "weekly" && state.recurrenceWeekdays.length > 0) {
    const days = state.recurrenceWeekdays
      .map(d => WEEKDAY_REVERSE_MAP[d])
      .filter(Boolean)
      .join(",");
    if (days) parts.push(`BYDAY=${days}`);
  }
  
  if (state.recurrenceEndType === "count") {
    parts.push(`COUNT=${Math.max(1, state.recurrenceEndCount)}`);
  } else if (state.recurrenceEndType === "until" && state.recurrenceEndDate) {
    // Convert YYYY-MM-DD to YYYYMMDDTHHMMSSZ (end of day UTC)
    const raw = state.recurrenceEndDate.replace(/-/g, "");
    parts.push(`UNTIL=${raw}T235959Z`);
  }
  
  return parts.join(";");
}

function buildFormFromDetail(detail: WordpressEventDetail, fallbackState: EventFormState): EventFormState {
  const meta = detail.meta ?? {};
  const parseMeta = (value: string, fallbackDate: string, fallbackTime: string) => {
    if (!value) {
      return { date: fallbackDate, time: fallbackTime };
    }
    const [rawDate, rawTime] = value.trim().split(" ");
    const datePart = rawDate?.length ? rawDate : fallbackDate;
    const timePart = rawTime?.slice(0, 5) ?? fallbackTime;
    return { date: datePart, time: timePart };
  };
  const startParts = parseMeta(
    coerceMetaString(meta, "_event_start"),
    fallbackState.startDate,
    fallbackState.startTime,
  );
  const endParts = parseMeta(
    coerceMetaString(meta, "_event_end"),
    fallbackState.endDate || fallbackState.startDate,
    fallbackState.endTime,
  );
  
  let mode = coerceMetaString(meta, "_event_location_mode");
  if (!["default", "saved", "custom"].includes(mode)) {
    mode = "default";
  }

  const isRecurring = coerceMetaString(meta, "_event_is_recurring") === "1";
  const rrule = coerceMetaString(meta, "_event_rrule");
  const rruleState = parseRRuleToState(rrule);

  return {
    title: detail.title?.raw ?? detail.title?.rendered ?? "",
    description: detail.content?.raw ?? "",
    allDay: coerceMetaString(meta, "_event_all_day") === "1",
    startDate: startParts.date,
    startTime: startParts.time,
    endDate: endParts.date,
    endTime: endParts.time,
    locationMode: mode as "default" | "saved" | "custom",
    locationSavedId: parseInt(coerceMetaString(meta, "_event_location_id"), 10) || 0,
    locationCustomText: mode === "custom" ? coerceMetaString(meta, "_event_location") : "",
    
    isRecurring,
    recurrenceInterval: rruleState.interval,
    recurrenceFrequency: rruleState.frequency,
    recurrenceWeekdays: rruleState.weekdays,
    recurrenceEndType: rruleState.endType,
    recurrenceEndCount: rruleState.endCount,
    recurrenceEndDate: rruleState.endDate,
  };
}

function formatDateInput(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

type TimeParts = {
  hour: string;
  minute: string;
  period: "AM" | "PM";
};

function toTimeParts(value?: string, fallback = DEFAULT_START_TIME): TimeParts {
  const candidate = value && value.includes(":") ? value : fallback;
  const [rawHour = fallback.slice(0, 2), rawMinute = fallback.slice(3, 5)] = candidate.split(":");
  const hourNum = Number.parseInt(rawHour, 10);
  const period: "AM" | "PM" = Number.isNaN(hourNum) ? "AM" : hourNum >= 12 ? "PM" : "AM";
  let hour12 = Number.isNaN(hourNum) ? 12 : hourNum % 12;
  if (hour12 === 0) {
    hour12 = 12;
  }
  const normalizedMinute = MINUTE_OPTIONS.includes(rawMinute) ? rawMinute : rawMinute.padStart(2, "0").slice(0, 2);
  return {
    hour: hour12.toString().padStart(2, "0"),
    minute: normalizedMinute,
    period,
  };
}

function fromTimeParts(parts: TimeParts): string {
  let hourNum = Number.parseInt(parts.hour, 10);
  if (Number.isNaN(hourNum)) {
    hourNum = 12;
  }
  hourNum = hourNum % 12;
  if (parts.period === "PM" && hourNum !== 12) {
    hourNum += 12;
  }
  if (parts.period === "AM" && hourNum === 12) {
    hourNum = 0;
  }
  return `${hourNum.toString().padStart(2, "0")}:${parts.minute}`;
}

type TimeSelectProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

function TimeSelect({ value, onChange, disabled }: TimeSelectProps) {
  const parts = toTimeParts(value);
  const updateParts = (partial: Partial<TimeParts>) => {
    const next = { ...parts, ...partial };
    onChange(fromTimeParts(next));
  };

  return (
    <div className={cn("flex items-center gap-2", disabled && "opacity-50 pointer-events-none")}>
      <Select disabled={disabled} value={parts.hour} onValueChange={(val: string) => updateParts({ hour: val })}>
        <SelectTrigger className="w-16">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {HOURS_12.map((hour) => (
            <SelectItem key={hour} value={hour}>
              {hour}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground">:</span>
      <Select disabled={disabled} value={parts.minute} onValueChange={(val: string) => updateParts({ minute: val })}>
        <SelectTrigger className="w-16">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MINUTE_OPTIONS.map((minute) => (
            <SelectItem key={minute} value={minute}>
              {minute}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        disabled={disabled}
        value={parts.period}
        onValueChange={(val: string) => updateParts({ period: val as "AM" | "PM" })}
      >
        <SelectTrigger className="w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_OPTIONS.map((period) => (
            <SelectItem key={period} value={period}>
              {period}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const CATEGORY_COLOR_MAP: Record<string, string> = {
  default: "bg-primary/10 text-primary",
  blue: "bg-blue-100 text-blue-800",
  green: "bg-emerald-100 text-emerald-800",
  pink: "bg-pink-100 text-pink-800",
  orange: "bg-orange-100 text-orange-800",
  purple: "bg-purple-100 text-purple-800",
};

function buildCalendarEventId(occurrence: WordpressEventOccurrence) {
  return `${occurrence.event_id}-${occurrence.start}`;
}

export default function CalendarPage() {
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate]);
  const monthEnd = useMemo(() => endOfMonth(currentDate), [currentDate]);
  const monthKey = format(currentDate, "yyyy-MM");
  const dateRange = useMemo(
    () => ({
      start: formatDateInput(monthStart),
      end: formatDateInput(monthEnd),
    }),
    [monthStart, monthEnd],
  );
  const defaultForm = useMemo(() => buildDefaultForm(dateRange), [dateRange]);
  const [formState, setFormState] = useState<EventFormState>(defaultForm);
  const [initialFormState, setInitialFormState] = useState<EventFormState | null>(defaultForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<WordpressEventOccurrence | null>(null);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [editingMeta, setEditingMeta] = useState<Record<string, unknown> | null>(null);
  const [detailStatus, setDetailStatus] = useState<{ loading: boolean; error: string | null }>({
    loading: false,
    error: null,
  });
  const editingEventIdRef = useRef<number | null>(null);

  const wpConfigured = useMemo(
    () =>
      Boolean(tenant?.wpSiteUrl) && Boolean(tenant?.wpApiUser) && Boolean(tenant?.wpAppPassword),
    [tenant?.wpSiteUrl, tenant?.wpApiUser, tenant?.wpAppPassword],
  );

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<WordpressEventsResponse>({
    queryKey: ["wordpress", "events", "month", monthKey],
    queryFn: () =>
      apiFetch<WordpressEventsResponse>(
        `/wordpress/events?start=${encodeURIComponent(dateRange.start)}&end=${encodeURIComponent(dateRange.end)}`,
        { method: "GET" },
        true,
      ),
    enabled: wpConfigured,
  });
  
  const { data: locations = [], isLoading: isLocationsLoading } = useQuery<WordpressLocation[]>({
    queryKey: ["wordpress", "locations"],
    queryFn: () => apiFetch<WordpressLocation[]>("/wordpress/locations", { method: "GET" }, true),
    enabled: wpConfigured,
  });

  const { data: settings, isLoading: isSettingsLoading } = useQuery<WordpressCecSettings>({
    queryKey: ["wordpress", "settings"],
    queryFn: () => apiFetch<WordpressCecSettings>("/wordpress/settings", { method: "GET" }, true),
    enabled: wpConfigured,
  });

  const defaultLocationLabel = useMemo(() => {
    if (!settings) return "";
    if (settings.default_location_mode === "text") return settings.default_location_text;
    if (settings.default_location_mode === "cpt") {
      const loc = locations.find((l) => l.id === settings.default_location_id);
      return loc?.title?.rendered || "Unknown Location";
    }
    return "";
  }, [settings, locations]);

  const isDetailLoading = detailStatus.loading;
  const isDetailError = Boolean(detailStatus.error);
  const detailError = detailStatus.error;

  const notifyFields = (
    initial: EventFormState,
    next: EventFormState,
    extra?: { created?: boolean; deleted?: boolean },
  ) => {
    if (extra?.created) {
      toast.success("Event created", {
        description: `Scheduled ${next.title} on ${next.startDate}${next.allDay ? "" : ` at ${next.startTime}`}.`,
      });
      return;
    }
    if (extra?.deleted) {
      toast.success("Event deleted", {
        description: `${initial.title || "Event"} has been removed.`,
      });
      return;
    }
    const changes: string[] = [];
    if (initial.title !== next.title) changes.push("title");
    if (initial.description !== next.description) changes.push("description");
    if (
      initial.locationMode !== next.locationMode ||
      initial.locationSavedId !== next.locationSavedId ||
      initial.locationCustomText !== next.locationCustomText
    ) {
      changes.push("location");
    }
    if (
      initial.startDate !== next.startDate ||
      initial.startTime !== next.startTime ||
      initial.endDate !== next.endDate ||
      initial.endTime !== next.endTime ||
      initial.allDay !== next.allDay
    ) {
      changes.push("schedule");
    }
    if (
      initial.isRecurring !== next.isRecurring ||
      (next.isRecurring && (
        initial.recurrenceFrequency !== next.recurrenceFrequency ||
        initial.recurrenceInterval !== next.recurrenceInterval ||
        initial.recurrenceWeekdays.join(",") !== next.recurrenceWeekdays.join(",") ||
        initial.recurrenceEndType !== next.recurrenceEndType
      ))
    ) {
      changes.push("recurrence");
    }
    
    if (changes.length === 0) {
      toast.info("Event updated", { description: "No fields changed." });
    } else {
      toast.success("Event updated", {
        description: `Updated ${changes.join(", ")}.`,
      });
    }
  };

  const loadEventDetail = async (eventId: number, fallbackState: EventFormState) => {
    setDetailStatus({ loading: true, error: null });
    try {
      const detail = await apiFetch<WordpressEventDetail>(
        `/wordpress/events/${eventId}`,
        { method: "GET" },
        true,
      );
      if (editingEventIdRef.current !== eventId) return;
      const next = buildFormFromDetail(detail, fallbackState);
      setFormState(next);
      setInitialFormState(next);
      setEditingMeta(detail.meta ?? {});
      setDetailStatus({ loading: false, error: null });
    } catch (errorInstance) {
      if (editingEventIdRef.current !== eventId) return;
      const message =
        errorInstance instanceof ApiError
          ? errorInstance.message
          : "Unable to load event details.";
      setDetailStatus({ loading: false, error: message });
    }
  };

  const createMutation = useMutation({
    mutationFn: (payload: WordpressEventUpsertPayload) =>
      apiFetch<unknown>("/wordpress/events", { method: "POST", body: JSON.stringify(payload) }, true),
    onMutate: async () => ({ initial: initialFormState ?? defaultForm, next: formState }),
    onSuccess: async (_, __, context) => {
      if (context) notifyFields(context.initial, context.next, { created: true });
      await Promise.all([refetch(), queryClient.invalidateQueries({ queryKey: ["wordpress", "events"] })]);
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError ? error.message : "Unable to create event.";
      toast.error("Create failed", { description: message });
    },
  });
  const updateMutation = useMutation({
    mutationFn: (input: { eventId: number; payload: WordpressEventUpsertPayload; original: EventFormState }) =>
      apiFetch<unknown>(
        `/wordpress/events/${input.eventId}`,
        { method: "PUT", body: JSON.stringify(input.payload) },
        true,
      ),
    onSuccess: async (_, variables) => {
      notifyFields(variables.original, formState);
      await Promise.all([refetch(), queryClient.invalidateQueries({ queryKey: ["wordpress", "events"] })]);
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError ? error.message : "Unable to update event.";
      toast.error("Update failed", { description: message });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (input: { eventId: number; snapshot: EventFormState }) =>
      apiFetch<unknown>(`/wordpress/events/${input.eventId}`, { method: "DELETE" }, true),
    onSuccess: async (_, variables) => {
      notifyFields(variables.snapshot, variables.snapshot, { deleted: true });
      await Promise.all([refetch(), queryClient.invalidateQueries({ queryKey: ["wordpress", "events"] })]);
    },
    onError: (error: unknown) => {
      const message = error instanceof ApiError ? error.message : "Unable to delete event.";
      toast.error("Delete failed", { description: message });
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const isResolving = isLocationsLoading || isSettingsLoading;

  const cloneMetaRecord = (
    meta?: Record<string, unknown> | null,
  ): Record<string, WordpressMetaPrimitive | WordpressMetaPrimitive[]> => {
    if (!meta) return {};
    const clone: Record<string, WordpressMetaPrimitive | WordpressMetaPrimitive[]> = {};
    for (const [key, value] of Object.entries(meta)) {
      if (
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        clone[key] = value;
      } else if (Array.isArray(value)) {
        const filtered = value.filter(
          (entry): entry is WordpressMetaPrimitive =>
            entry === null ||
            typeof entry === "string" ||
            typeof entry === "number" ||
            typeof entry === "boolean",
        );
        clone[key] = filtered;
      }
    }
    return clone;
  };

  const assemblePayload = (
    state: EventFormState,
    existingMeta?: Record<string, unknown> | null,
  ): { payload?: WordpressEventUpsertPayload; error?: string } => {
    const title = state.title.trim();
    if (!title) return { error: "Title is required" };
    
    const start = parseInputsToDate(state.startDate, state.startTime);
    const end = parseInputsToDate(state.endDate, state.endTime);
    
    let endDateForMeta = state.endDate;
    let endTimeValue = state.endTime;
    
    if (end <= start) {
      if (state.startDate === state.endDate) {
        const nextDay = new Date(start);
        nextDay.setDate(nextDay.getDate() + 1);
        endDateForMeta = formatDateInput(nextDay);
      } else {
        return { error: "End date/time must be after the start date/time" };
      }
    }

    const startTimeValue = state.startTime || DEFAULT_START_TIME;
    endTimeValue = endTimeValue || DEFAULT_END_TIME;

    const startMeta = composeMetaDateTime(state.startDate, startTimeValue);
    const endMeta = composeMetaDateTime(endDateForMeta, endTimeValue);

    const mergedMeta = cloneMetaRecord(existingMeta);

    let locationText = "";
    if (state.locationMode === "custom") {
      locationText = state.locationCustomText;
    } else if (state.locationMode === "saved") {
      const loc = locations.find((l) => l.id === state.locationSavedId);
      locationText = loc?.title?.rendered || "";
    } else {
      locationText = defaultLocationLabel;
    }
    
    const rrule = buildRRule(state);

    const payload: WordpressEventUpsertPayload = {
      title,
      content: state.description.trim() ? state.description.trim() : undefined,
      status: "publish",
      meta: {
        ...mergedMeta,
        _event_start: startMeta,
        _event_end: endMeta,
        _event_all_day: state.allDay ? "1" : "0",
        _event_location_mode: state.locationMode,
        _event_location_id: state.locationMode === "saved" ? String(state.locationSavedId) : "0",
        _event_location: locationText,
        
        // Recurrence
        _event_is_recurring: state.isRecurring ? "1" : "0",
        _event_recurrence_interval: String(state.recurrenceInterval),
        _event_recurrence_weekdays: state.isRecurring ? state.recurrenceWeekdays : [],
        _event_rrule: rrule,
      },
    };
    return { payload };
  };

  const handleSave = () => {
    setFormError(null);
    const { payload, error } = assemblePayload(formState, editingMeta);
    if (error || !payload) {
      setFormError(error ?? "Invalid form");
      return;
    }
    if (editingEventId) {
      updateMutation.mutate({ eventId: editingEventId, payload, original: initialFormState ?? defaultForm });
      setDialogOpen(false);
    } else {
      createMutation.mutate(payload);
      setDialogOpen(false);
    }
  };

  const handleDelete = () => {
    if (!editingEventId) return;
    if (!confirm("Are you sure you want to delete this event?")) return;
    deleteMutation.mutate({ eventId: editingEventId, snapshot: formState });
    setDialogOpen(false);
  };

  const handleCreate = (dateStr: string) => {
    const nextRange = { start: dateStr, end: dateStr };
    const form = buildDefaultForm(nextRange);
    setFormState(form);
    setInitialFormState(form);
    setEditingEvent(null);
    setEditingEventId(null);
    setEditingMeta(null);
    editingEventIdRef.current = null;
    setFormError(null);
    setDetailStatus({ loading: false, error: null });
    setDialogOpen(true);
  };

  const handleEdit = (occurrence: WordpressEventOccurrence) => {
    const form = buildFormFromOccurrence(occurrence, dateRange);
    setFormState(form);
    setInitialFormState(form);
    setEditingEvent(occurrence);
    setEditingEventId(occurrence.event_id);
    setEditingMeta(null);
    editingEventIdRef.current = occurrence.event_id;
    setFormError(null);
    setDetailStatus({ loading: false, error: null });
    setDialogOpen(true);
    loadEventDetail(occurrence.event_id, form);
  };

  const handleClose = () => setDialogOpen(false);
  const handleWeekdayToggle = (day: string) => {
    setFormState(prev => {
      const exists = prev.recurrenceWeekdays.includes(day);
      const nextDays = exists
        ? prev.recurrenceWeekdays.filter(d => d !== day)
        : [...prev.recurrenceWeekdays, day];
      return { ...prev, recurrenceWeekdays: nextDays };
    });
  };

  const occurrences = data?.occurrences ?? [];
  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    return occurrences.map((occ) => {
      const primaryCategory = occ.categories?.[0]?.slug ?? "default";
      const colorClass = CATEGORY_COLOR_MAP[primaryCategory as keyof typeof CATEGORY_COLOR_MAP] ?? CATEGORY_COLOR_MAP.default;
      return {
        id: buildCalendarEventId(occ),
        title: occ.title || "(No Title)",
        startDate: occ.start,
        endDate: occ.end,
        categoryColor: colorClass,
        source: occ,
      };
    });
  }, [occurrences]);
  const occurrenceMap = useMemo(() => {
    const map = new Map<string, WordpressEventOccurrence>();
    occurrences.forEach((occ) => {
      map.set(buildCalendarEventId(occ), occ);
    });
    return map;
  }, [occurrences]);

  const handleCreateForDate = (date: Date) => {
    handleCreate(formatDateInput(date));
  };

  const handleEditFromCalendar = (calendarEventId: string) => {
    const occ = occurrenceMap.get(calendarEventId);
    if (!occ) return;
    handleEdit(occ);
  };



  if (!wpConfigured) {
    return (
      <div className="p-4">
        <Alert>
          <AlertTitle>Configuration Needed</AlertTitle>
          <AlertDescription>Please configure your WordPress connection in Settings to use the calendar.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Calendar</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/calendar/import">Import from Image</Link>
          </Button>
          <Button onClick={() => handleCreate(dateRange.start)}>Add Event</Button>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading || isFetching}>
            {isFetching ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error instanceof Error ? error.message : "Failed to load events"}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Loading calendar…</div>
      ) : (
        // Calendar UI lives in `components/calendar/calendar-month.tsx` and is surfaceable
        // via Dashboard → Calendar (this page). The "+" day action reuses `handleCreateForDate`
        // which opens the existing dialog, and clicking an event pill calls `handleEditFromCalendar`
        // so the same edit flow is shown as before.
        <CalendarMonth
          visibleMonth={currentDate}
          events={calendarEvents}
          onPrevMonth={() => setCurrentDate((prev) => addMonths(prev, -1))}
          onNextMonth={() => setCurrentDate((prev) => addMonths(prev, 1))}
          onCreateEventForDate={handleCreateForDate}
          onEditEvent={handleEditFromCalendar}
        />
      )}


      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEventId ? "Edit Event" : "New Event"}</DialogTitle>
            <DialogDescription>{editingEventId ? "Modify event details." : "Schedule a new event."}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4 md:grid-cols-2">
            {/* Left Column: Schedule */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formState.title}
                  onChange={(e) => setFormState((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Event title"
                />
              </div>

              <div className="grid gap-4">
                {/* Start */}
                <div className="flex gap-4">
                  <div className="flex flex-col gap-3 flex-1">
                    <Label className="px-1">Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-between text-left font-normal",
                            !formState.startDate && "text-muted-foreground"
                          )}
                        >
                          {formState.startDate ? (
                            format(parse(formState.startDate, 'yyyy-MM-dd', new Date()), "P")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <ChevronDownIcon className="h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formState.startDate ? parse(formState.startDate, 'yyyy-MM-dd', new Date()) : undefined}
                          onSelect={(date) => date && setFormState((prev) => ({ ...prev, startDate: format(date, 'yyyy-MM-dd') }))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex flex-col gap-3 w-full max-w-xs">
                    <Label className="px-1">Start Time</Label>
                    <TimeSelect
                      value={formState.startTime}
                      disabled={formState.allDay}
                      onChange={(value) => setFormState((prev) => ({ ...prev, startTime: value }))}
                    />
                  </div>
                </div>

                {/* End */}
                <div className="flex gap-4">
                  <div className="flex flex-col gap-3 flex-1">
                    <Label className="px-1">End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-between text-left font-normal",
                            !formState.endDate && "text-muted-foreground"
                          )}
                        >
                          {formState.endDate ? (
                            format(parse(formState.endDate, 'yyyy-MM-dd', new Date()), "P")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <ChevronDownIcon className="h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formState.endDate ? parse(formState.endDate, 'yyyy-MM-dd', new Date()) : undefined}
                          onSelect={(date) => date && setFormState((prev) => ({ ...prev, endDate: format(date, 'yyyy-MM-dd') }))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex flex-col gap-3 w-full max-w-xs">
                    <Label className="px-1">End Time</Label>
                    <TimeSelect
                      value={formState.endTime}
                      disabled={formState.allDay}
                      onChange={(value) => setFormState((prev) => ({ ...prev, endTime: value }))}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allDay"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={formState.allDay}
                  onChange={(e) => setFormState((prev) => ({ ...prev, allDay: e.target.checked }))}
                />
                <Label htmlFor="allDay">All Day Event</Label>
              </div>
              
              <div className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  id="isRecurring"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={formState.isRecurring}
                  onChange={(e) => setFormState((prev) => ({ ...prev, isRecurring: e.target.checked }))}
                />
                <Label htmlFor="isRecurring">Recurring Event</Label>
              </div>
              
              {formState.isRecurring && (
                <div className="border-l-2 border-border pl-4 space-y-4 mt-2">
                  <div className="flex items-center gap-2">
                    <Label className="whitespace-nowrap">Repeat every</Label>
                    <Input
                      type="number"
                      min={1}
                      className="w-20"
                      value={formState.recurrenceInterval}
                      onChange={(e) => setFormState((prev) => ({ ...prev, recurrenceInterval: parseInt(e.target.value, 10) || 1 }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={formState.recurrenceFrequency}
                      onChange={(e) => setFormState((prev) => ({ ...prev, recurrenceFrequency: e.target.value as any }))}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  
                  {formState.recurrenceFrequency === "weekly" && (
                    <div className="space-y-2">
                      <Label>Weekdays</Label>
                      <div className="flex flex-wrap gap-4">
                        {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => (
                          <label key={day} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300"
                              checked={formState.recurrenceWeekdays.includes(day)}
                              onChange={() => handleWeekdayToggle(day)}
                            />
                            <span className="text-sm capitalize">{day}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-2 pt-2">
                    <Label>Ends</Label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="recurrenceEndType"
                          value="never"
                          checked={formState.recurrenceEndType === "never"}
                          onChange={() => setFormState((prev) => ({ ...prev, recurrenceEndType: "never" }))}
                        />
                        <span className="text-sm">Never</span>
                      </label>
                      
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="recurrenceEndType"
                          value="count"
                          checked={formState.recurrenceEndType === "count"}
                          onChange={() => setFormState((prev) => ({ ...prev, recurrenceEndType: "count" }))}
                        />
                        <span className="text-sm whitespace-nowrap">After</span>
                        <Input
                          type="number"
                          min={1}
                          className="w-20 h-8"
                          value={formState.recurrenceEndCount}
                          onChange={(e) => setFormState((prev) => ({ ...prev, recurrenceEndCount: parseInt(e.target.value, 10) || 1 }))}
                          disabled={formState.recurrenceEndType !== "count"}
                        />
                        <span className="text-sm">occurrences</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="recurrenceEndType"
                          value="until"
                          checked={formState.recurrenceEndType === "until"}
                          onChange={() => setFormState((prev) => ({ ...prev, recurrenceEndType: "until" }))}
                        />
                        <span className="text-sm whitespace-nowrap">On date</span>
                        <Input
                          type="date"
                          className="w-auto h-8"
                          value={formState.recurrenceEndDate}
                          onChange={(e) => setFormState((prev) => ({ ...prev, recurrenceEndDate: e.target.value }))}
                          disabled={formState.recurrenceEndType !== "until"}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Location & Details */}
            <div className="space-y-4">
              <div className="space-y-3">
                <Label>Location</Label>
                
                <div className="space-y-2">
                  <label className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="locationMode"
                      value="default"
                      checked={formState.locationMode === "default"}
                      onChange={() => setFormState((prev) => ({ ...prev, locationMode: "default" }))}
                      className="mt-1"
                    />
                    <div className="text-sm">
                      <div className="font-medium">Use default location (from Settings)</div>
                      <div className="text-muted-foreground">
                         Current default: {isResolving ? "Loading..." : defaultLocationLabel || "None configured"}
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="locationMode"
                      value="saved"
                      checked={formState.locationMode === "saved"}
                      onChange={() => setFormState((prev) => ({ ...prev, locationMode: "saved" }))}
                    />
                    <span className="text-sm font-medium">Use a saved location</span>
                  </label>

                  {formState.locationMode === "saved" && (
                    <div className="ml-6">
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={formState.locationSavedId}
                        onChange={(e) =>
                          setFormState((prev) => ({
                            ...prev,
                            locationSavedId: parseInt(e.target.value, 10),
                          }))
                        }
                      >
                        <option value={0}>Select a location...</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.title.rendered || `Location #${loc.id}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="locationMode"
                      value="custom"
                      checked={formState.locationMode === "custom"}
                      onChange={() => setFormState((prev) => ({ ...prev, locationMode: "custom" }))}
                    />
                    <span className="text-sm font-medium">Use custom location text</span>
                  </label>

                  {formState.locationMode === "custom" && (
                    <div className="ml-6">
                      <Input
                        value={formState.locationCustomText}
                        onChange={(e) =>
                          setFormState((prev) => ({ ...prev, locationCustomText: e.target.value }))
                        }
                        placeholder="Enter location address..."
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={formState.description}
                  onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {formError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Validation Error</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          {detailError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Load Error</AlertTitle>
              <AlertDescription>{detailError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2">
            {editingEventId && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting || isSaving}
              >
                {isDeleting ? "Deleting..." : "Delete Event"}
              </Button>
            )}
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || isDetailLoading || isResolving}>
              {isSaving ? "Saving..." : editingEventId ? "Update Event" : "Create Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
