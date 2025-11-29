"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckIcon, ChevronDownIcon, PencilIcon } from "lucide-react";
import { format, parse } from "date-fns";

import { useAuth } from "@/hooks/useAuth";
import { ApiError, apiFetch } from "@/lib/api-client";
import { compressImageToJpeg } from "@/lib/image/compress-image";
import { DraftPosterEvent, ImportPosterResponse, uploadPosterImage } from "@/lib/api/ai";
import { buildCreatePayloadFromDraft } from "@/lib/events/from-poster";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dropzone, DropzoneContent, DropzoneEmptyState } from "@/components/ui/shadcn-io/dropzone";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

type EditablePosterDraft = DraftPosterEvent & {
  selected: boolean;
  descriptionLoading: boolean;
  descriptionGenerated: boolean;
  aiDescription: string;
};

export default function ImportPosterPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { tenant } = useAuth();

  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [compressedPosterFile, setCompressedPosterFile] = useState<File | null>(null);
  const [compressionInfo, setCompressionInfo] = useState<{ originalSize: number; compressedSize: number } | null>(null);
  const [compressionError, setCompressionError] = useState<string | null>(null);
  const [uploadResponse, setUploadResponse] = useState<ImportPosterResponse | null>(null);
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);
  const [posterDrafts, setPosterDrafts] = useState<EditablePosterDraft[]>([]);
  const [isCompressingPoster, setIsCompressingPoster] = useState(false);
  const [isUploadingPoster, setIsUploadingPoster] = useState(false);
  const [isCreatingPosterEvents, setIsCreatingPosterEvents] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const descriptionTimersRef = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({});

  const clearDescriptionTimerById = (id: string) => {
    const timer = descriptionTimersRef.current[id];
    if (timer) {
      clearTimeout(timer);
    }
    delete descriptionTimersRef.current[id];
  };

  const clearDescriptionTimers = () => {
    Object.keys(descriptionTimersRef.current).forEach((key) => {
      clearDescriptionTimerById(key);
    });
  };

  const wpConfigured = useMemo(
    () =>
      Boolean(tenant?.wpSiteUrl) && Boolean(tenant?.wpApiUser) && Boolean(tenant?.wpAppPassword),
    [tenant?.wpSiteUrl, tenant?.wpApiUser, tenant?.wpAppPassword],
  );

  const selectedPosterDrafts = posterDrafts.filter((draft) => draft.selected);
  const selectedPosterDraftCount = selectedPosterDrafts.length;

  const processPosterFile = async (file: File) => {
    setPosterFile(file);
    setCompressionError(null);
    setUploadResponse(null);
    setUploadErrorMessage(null);
    setPosterDrafts([]);
    setIsCompressingPoster(true);
    try {
      const compressed = await compressImageToJpeg(file, { maxWidth: 1280, quality: 0.7 });
      setCompressedPosterFile(compressed);
      setCompressionInfo({ originalSize: file.size, compressedSize: compressed.size });
    } catch (errorInstance) {
      const message = errorInstance instanceof Error ? errorInstance.message : "Failed to compress image.";
      setCompressionError(message);
      setCompressedPosterFile(null);
      setCompressionInfo(null);
    } finally {
      setIsCompressingPoster(false);
    }
  };

  const handlePosterDrop = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    await processPosterFile(file);
  };

  const handlePosterUpload = async () => {
    if (!compressedPosterFile) return;
    setIsUploadingPoster(true);
    setUploadErrorMessage(null);
    setUploadResponse(null);
    setPosterDrafts([]);
    try {
      const response = await uploadPosterImage(compressedPosterFile);
      setUploadResponse(response);
      const nextDrafts = response.events.map((event) => ({
        ...event,
        title: event.title ?? "",
        location: event.location ?? "",
        notes: event.notes ?? "",
        description: "",
        uncertainty: event.uncertainty ?? "",
        relatedEventTitle: event.relatedEventTitle ?? "",
        relatedEventDetails: event.relatedEventDetails ?? "",
        selected: true,
        descriptionLoading: false,
        descriptionGenerated: false,
        aiDescription: event.description ?? "",
      }));
      setPosterDrafts(nextDrafts);
    } catch (errorInstance) {
      const message = errorInstance instanceof Error ? errorInstance.message : "Failed to upload poster.";
      setUploadErrorMessage(message);
    } finally {
      setIsUploadingPoster(false);
    }
  };

  useEffect(() => {
    return () => {
      clearDescriptionTimers();
    };
  }, []);

  const updatePosterDraftDate = (
    id: string,
    key: "startDateTime" | "endDateTime",
    dateValue: string,
  ) => {
    setPosterDrafts((prev) =>
      prev.map((draft) => {
        if (draft.id !== id) return draft;
        const fallbackIso =
          key === "endDateTime"
            ? draft.endDateTime ?? draft.startDateTime
            : draft.startDateTime;
        const existingTime =
          key === "endDateTime"
            ? getIsoTimePart(draft.endDateTime ?? draft.startDateTime)
            : getIsoTimePart(draft.startDateTime);
        return {
          ...draft,
          [key]: mergeDateTimeParts(dateValue, existingTime, fallbackIso),
        };
      }),
    );
  };

  const updatePosterDraftTime = (
    id: string,
    key: "startDateTime" | "endDateTime",
    timeValue: string,
  ) => {
    setPosterDrafts((prev) =>
      prev.map((draft) => {
        if (draft.id !== id) return draft;
        const fallbackIso =
          key === "endDateTime"
            ? draft.endDateTime ?? draft.startDateTime
            : draft.startDateTime;
        const existingDate =
          key === "endDateTime"
            ? getIsoDatePart(draft.endDateTime ?? draft.startDateTime)
            : getIsoDatePart(draft.startDateTime);
        return {
          ...draft,
          [key]: mergeDateTimeParts(existingDate, timeValue, fallbackIso),
        };
      }),
    );
  };

  const handleGenerateDescription = (id: string) => {
    const targetDraft = posterDrafts.find((draft) => draft.id === id);
    if (!targetDraft) return;

    const descriptionText = (targetDraft.aiDescription ?? "").trim();

    clearDescriptionTimerById(id);

    setPosterDrafts((prev) =>
      prev.map((draft) =>
        draft.id === id
          ? {
              ...draft,
              descriptionLoading: true,
              descriptionGenerated: false,
              description: "",
            }
          : draft,
      ),
    );

    const waitTimer = setTimeout(() => {
      startDescriptionTyping(id, descriptionText);
    }, 600);

    descriptionTimersRef.current[id] = waitTimer;
  };

  const startDescriptionTyping = (id: string, fullText: string) => {
    clearDescriptionTimerById(id);

    if (!fullText) {
      setPosterDrafts((prev) =>
        prev.map((draft) =>
          draft.id === id
            ? {
                ...draft,
                description: "No description detected.",
                descriptionLoading: false,
                descriptionGenerated: true,
              }
            : draft,
        ),
      );
      return;
    }

    const interval = 25;
    let index = 0;

    const typeNext = () => {
      index += 1;
      setPosterDrafts((prev) =>
        prev.map((draft) =>
          draft.id === id
            ? {
                ...draft,
                description: fullText.slice(0, index),
              }
            : draft,
        ),
      );

      if (index < fullText.length) {
        const timerId = setTimeout(typeNext, interval);
        descriptionTimersRef.current[id] = timerId;
      } else {
        setPosterDrafts((prev) =>
          prev.map((draft) =>
            draft.id === id
              ? {
                  ...draft,
                  description: fullText,
                  descriptionLoading: false,
                  descriptionGenerated: true,
                }
              : draft,
          ),
        );
        clearDescriptionTimerById(id);
      }
    };

    typeNext();
  };

  const handleCreateSelectedDrafts = async () => {
    const draftsToCreate = posterDrafts.filter((draft) => draft.selected);
    if (draftsToCreate.length === 0) {
      toast.info("Select at least one event to create.");
      return;
    }
    const invalidDraft = draftsToCreate.find((draft) => !isValidDraft(draft));
    if (invalidDraft) {
      toast.error("Please fix the highlighted event before creating.", {
        description: invalidDraft.title || "Missing title or date.",
      });
      return;
    }

    setIsCreatingPosterEvents(true);
    let createdCount = 0;
    const draftIds = draftsToCreate.map((draft) => draft.id);

    for (const draft of draftsToCreate) {
      try {
        const payload = buildCreatePayloadFromDraft(draft);
        await apiFetch<unknown>(
          "/wordpress/events",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
          true,
        );
        createdCount += 1;
      } catch (errorInstance) {
        const message =
          errorInstance instanceof ApiError ? errorInstance.message : "Unable to create event.";
        toast.error(`Failed to create ${draft.title || "event"}`, { description: message });
      }
    }

    setIsCreatingPosterEvents(false);

    if (createdCount > 0) {
      toast.success(`Created ${createdCount} event${createdCount === 1 ? "" : "s"} from poster.`);
      setPosterDrafts((prev) => prev.filter((draft) => !draftIds.includes(draft.id)));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["wordpress", "events"] }),
      ]);
      router.push("/dashboard/calendar");
    }
  };

  if (!wpConfigured) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTitle>Configuration Needed</AlertTitle>
          <AlertDescription>
            Please configure your WordPress connection in Settings to use the poster import feature.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Import events from image</h2>
          <p className="text-sm text-muted-foreground">
            Upload a poster, review the detected events, and create them in WordPress.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {posterDrafts.length > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                setPosterFile(null);
                setCompressedPosterFile(null);
                setCompressionInfo(null);
                setCompressionError(null);
                setUploadResponse(null);
                setUploadErrorMessage(null);
                setPosterDrafts([]);
                setIsCompressingPoster(false);
                setIsUploadingPoster(false);
                clearDescriptionTimers();
              }}
            >
              Import another image
            </Button>
          )}
          <Button variant="ghost" asChild>
            <Link href="/dashboard/calendar">← Back to calendar</Link>
          </Button>
        </div>
      </div>

      {posterDrafts.length === 0 && (
        <>
          {isUploadingPoster ? (
            <div className="rounded-2xl bg-muted/40 p-6">
              <div className="flex min-h-[320px] items-center justify-center">
                <Spinner className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Dropzone
                  accept={{ "image/*": [".png", ".jpg", ".jpeg"] }}
                  maxFiles={1}
                  disabled={isCompressingPoster}
                  onDrop={(accepted: File[]) => void handlePosterDrop(accepted)}
                  onError={(error) => setCompressionError(error.message)}
                  src={posterFile ? [posterFile] : undefined}
                >
                  <DropzoneEmptyState>
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <p className="text-sm font-medium">Drag and drop or click to upload</p>
                      <p className="text-xs text-muted-foreground">Accepts JPG and PNG up to ~10MB.</p>
                    </div>
                  </DropzoneEmptyState>
                  <DropzoneContent />
                </Dropzone>
                <p className="text-xs text-muted-foreground">
                  Images wider than 1280px will be compressed in your browser before upload.
                </p>
              </div>

              {posterFile && (
                <div className="rounded-md border p-3 space-y-1 text-sm">
                  <div>
                    <span className="font-medium">Original:</span> {posterFile.name} ({formatBytes(posterFile.size)})
                  </div>
                  {compressionInfo && (
                    <div>
                      <span className="font-medium">Compressed:</span> {compressedPosterFile?.name} (
                      {formatBytes(compressionInfo.compressedSize)})
                    </div>
                  )}
                  {isCompressingPoster && <div className="text-xs text-muted-foreground">Compressing…</div>}
                </div>
              )}

              {compressionError && <p className="text-sm text-destructive">{compressionError}</p>}

              <div className="flex items-center gap-2">
                <Button
                  onClick={handlePosterUpload}
                  disabled={!compressedPosterFile || isCompressingPoster}
                >
                  Upload & extract
                </Button>
                {compressedPosterFile && (
                  <span className="text-xs text-muted-foreground">
                    The compressed JPEG (≈{formatBytes(compressedPosterFile.size)}) will be uploaded.
                  </span>
                )}
              </div>

              {uploadErrorMessage && <p className="text-sm text-destructive">{uploadErrorMessage}</p>}
            </div>
          )}
        </>
      )}

      {posterDrafts.length > 0 && (
        <div className="space-y-3 rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Detected events</h3>
              <p className="text-xs text-muted-foreground">
                Review and adjust each event before creating it. Uncheck rows you don’t want to import.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedPosterDraftCount} of {posterDrafts.length} selected
            </p>
          </div>

          <div className="divide-y divide-border">
            {posterDrafts.map((draft) => {
              const startDate = getIsoDatePart(draft.startDateTime);
              const startTime = getIsoTimePart(draft.startDateTime);
              const endDate = getIsoDatePart(draft.endDateTime ?? draft.startDateTime);
              const endTime = getIsoTimePart(draft.endDateTime ?? draft.startDateTime);
              return (
                <div key={draft.id} className="grid gap-4 py-6 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={draft.selected}
                        disabled={isCreatingPosterEvents}
                        onCheckedChange={(value: boolean | "indeterminate") =>
                          setPosterDrafts((prev) =>
                            prev.map((item) =>
                              item.id === draft.id ? { ...item, selected: value === true } : item,
                            ),
                          )
                        }
                      />
                      <Label className="text-sm font-semibold">Include</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">All day</Label>
                      <Checkbox
                        checked={draft.isAllDay}
                        disabled={isCreatingPosterEvents}
                        onCheckedChange={(value: boolean | "indeterminate") =>
                          setPosterDrafts((prev) =>
                            prev.map((item) =>
                              item.id === draft.id ? { ...item, isAllDay: value === true } : item,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <div className="flex items-center gap-2">
                      {editingTitleId === draft.id ? (
                        <>
                          <input
                            className="border-0 border-b border-dashed border-input bg-transparent text-2xl font-semibold outline-none focus:border-b-2 focus:border-primary focus:ring-0"
                            style={{ width: `${Math.max(draft.title.length, 8)}ch` }}
                            value={draft.title}
                            disabled={isCreatingPosterEvents}
                            onChange={(event) =>
                              setPosterDrafts((prev) =>
                                prev.map((item) =>
                                  item.id === draft.id ? { ...item, title: event.target.value } : item,
                                ),
                              )
                            }
                            maxLength={40}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isCreatingPosterEvents}
                            onClick={() => setEditingTitleId(null)}
                          >
                            <CheckIcon className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <h2 className="text-2xl font-semibold">
                            {draft.title?.trim() ? draft.title : "Untitled event"}
                          </h2>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isCreatingPosterEvents}
                            onClick={() => setEditingTitleId(draft.id)}
                          >
                            <PencilIcon className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Schedule</Label>
                    <div className="flex flex-wrap items-center gap-3">
                      <DateSelectButton
                        value={startDate}
                        disabled={isCreatingPosterEvents}
                        onChange={(value) => updatePosterDraftDate(draft.id, "startDateTime", value)}
                      />
                      <TimeSelect
                        value={startTime}
                        disabled={isCreatingPosterEvents || draft.isAllDay}
                        onChange={(value) => updatePosterDraftTime(draft.id, "startDateTime", value)}
                      />
                      <span className="text-muted-foreground">→</span>
                      <DateSelectButton
                        value={endDate}
                        disabled={isCreatingPosterEvents}
                        onChange={(value) => updatePosterDraftDate(draft.id, "endDateTime", value)}
                      />
                      <TimeSelect
                        value={endTime}
                        disabled={isCreatingPosterEvents || draft.isAllDay}
                        onChange={(value) => updatePosterDraftTime(draft.id, "endDateTime", value)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Location</Label>
                    <Input
                      value={draft.location ?? ""}
                      disabled={isCreatingPosterEvents}
                      onChange={(event) =>
                        setPosterDrafts((prev) =>
                          prev.map((item) =>
                            item.id === draft.id ? { ...item, location: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Description</Label>
                    <textarea
                      className="min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={draft.description ?? ""}
                      disabled={isCreatingPosterEvents || draft.descriptionLoading}
                      onChange={(event) =>
                        setPosterDrafts((prev) =>
                          prev.map((item) =>
                            item.id === draft.id ? { ...item, description: event.target.value } : item,
                          ),
                        )
                      }
                    />
                    {!draft.descriptionGenerated && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-fit"
                        disabled={draft.descriptionLoading || isCreatingPosterEvents}
                        onClick={() => handleGenerateDescription(draft.id)}
                      >
                        {draft.descriptionLoading ? (
                          <>
                            <Spinner className="mr-2 h-4 w-4" />
                            Generating…
                          </>
                        ) : (
                          "Generate description"
                        )}
                      </Button>
                    )}
                  </div>

                  {draft.uncertainty && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold">Uncertainty:</span> {draft.uncertainty}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-3">
            <p className="text-xs text-muted-foreground">
              {selectedPosterDraftCount} of {posterDrafts.length} selected
            </p>
            <Button
              onClick={handleCreateSelectedDrafts}
              disabled={isCreatingPosterEvents || selectedPosterDraftCount === 0}
            >
              {isCreatingPosterEvents
                ? "Creating events…"
                : `Create ${selectedPosterDraftCount} event${selectedPosterDraftCount === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}

      {uploadResponse && posterDrafts.length === 0 && (
        <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
          No events were detected in this poster. Try another image or add events manually.
        </div>
      )}

      {uploadResponse && (
        <div className="space-y-2">
          <Label>Raw response</Label>
          <pre className="max-h-72 max-w-[400px] overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(uploadResponse, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function formatBytes(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(size) / Math.log(1024)));
  const value = size / 1024 ** exponent;
  const precision = value >= 10 || exponent === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[exponent]}`;
}

function getIsoDatePart(iso?: string | null) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function getIsoTimePart(iso?: string | null) {
  if (!iso) return "";
  return iso.slice(11, 16);
}

function mergeDateTimeParts(datePart?: string, timePart?: string, fallbackIso?: string | null) {
  const base = isIsoValue(fallbackIso) ? fallbackIso! : new Date().toISOString();
  const offsetMatch = base.match(/([+-]\d{2}:\d{2}|Z)$/);
  const offset = offsetMatch ? offsetMatch[1] : "Z";
  const safeDate = datePart && datePart.length >= 8 ? datePart : getIsoDatePart(base);
  const safeTime = timePart && timePart.length >= 4 ? timePart : getIsoTimePart(base) || "00:00";
  return `${safeDate}T${safeTime}:00${offset}`;
}

function isIsoValue(value?: string | null) {
  return Boolean(value && !Number.isNaN(Date.parse(value)));
}

function isValidDraft(draft: DraftPosterEvent) {
  if (!draft.title?.trim()) return false;
  if (!isIsoValue(draft.startDateTime)) return false;
  if (draft.endDateTime && !isIsoValue(draft.endDateTime)) return false;
  return true;
}

type DateSelectButtonProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

function DateSelectButton({ value, onChange, disabled }: DateSelectButtonProps) {
  const parsedDate = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-[170px] justify-between text-left font-normal",
            !value && "text-muted-foreground",
          )}
        >
          {parsedDate ? format(parsedDate, "PP") : <span>Select date</span>}
          <ChevronDownIcon className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parsedDate}
          onSelect={(nextDate) => {
            if (nextDate) {
              onChange(format(nextDate, "yyyy-MM-dd"));
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

type TimeParts = {
  hour: string;
  minute: string;
  period: "AM" | "PM";
};

const HOURS_12 = ["12", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11"];
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => index.toString().padStart(2, "0"));
const PERIOD_OPTIONS: Array<"AM" | "PM"> = ["AM", "PM"];
const TIME_FALLBACK = "09:00";

function toTimeParts(value?: string, fallback = TIME_FALLBACK): TimeParts {
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
  const update = (partial: Partial<TimeParts>) => {
    const next = { ...parts, ...partial };
    onChange(fromTimeParts(next));
  };

  return (
    <div className={cn("flex items-center gap-2", disabled && "pointer-events-none opacity-50")}>
      <Select disabled={disabled} value={parts.hour} onValueChange={(val: string) => update({ hour: val })}>
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

      <Select disabled={disabled} value={parts.minute} onValueChange={(val: string) => update({ minute: val })}>
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
        onValueChange={(val: string) => update({ period: val as "AM" | "PM" })}
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
