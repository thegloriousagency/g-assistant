"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { WordpressConnectionTestResult } from "@/types/wordpress";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TenantUser {
  id: string;
  email: string;
  role: string;
}

interface TenantDetail {
  id: string;
  name: string;
  websiteUrl?: string | null;
  contactEmail?: string | null;
  wpSiteUrl?: string | null;
  wpApiUser?: string | null;
  wpAppPassword?: string | null;
  hostingExpirationDate?: string | null;
  hostingCpanelUsername?: string | null;
  maintenanceExpirationDate?: string | null;
  hostingOrdered: boolean;
  maintenanceOrdered: boolean;
  maintenancePlanName?: string | null;
  maintenanceHoursPerMonth?: number | null;
  maintenanceCarryoverMode?: string | null;
  maintenanceStartDate?: string | null;
  maintenanceExtraHourlyRate?: number | null;
  maintenanceNotesInternal?: string | null;
  ga4PropertyId?: string | null;
  ga4ConnectedAt?: string | null;
  ga4LastSyncStatus?: string | null;
  users: TenantUser[];
}

interface MaintenanceCycle {
  id: string;
  tenantId: string;
  month: string;
  baseHours: number;
  carriedHours: number;
  usedHours: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface MaintenanceTask {
  id: string;
  tenantId: string;
  title: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface MaintenanceEntry {
  id: string;
  tenantId: string;
  cycleId: string;
  taskId?: string | null;
  date: string;
  durationHours: number;
  isIncludedInPlan: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MaintenanceFeatureItem {
  id: string;
  key: string;
  label: string;
  description?: string | null;
  isActive: boolean;
}

interface TenantFeatureSelection {
  tenantId: string;
  selectedFeatureIds: string[];
  features: MaintenanceFeatureItem[];
}

const basicInfoSchema = z.object({
  name: z.string().min(2, "Name is required"),
  websiteUrl: z.string().url("Enter a valid URL").or(z.literal("")).optional(),
  contactEmail: z.string().email("Enter a valid email").or(z.literal("")).optional(),
});

const wordpressSchema = z.object({
  wpSiteUrl: z.string().url("Enter a valid URL").or(z.literal("")).optional(),
  wpApiUser: z.string().or(z.literal("")).optional(),
  wpAppPassword: z.string().or(z.literal("")).optional(),
});

const hostingSchema = z.object({
  hostingExpirationDate: z.string().or(z.literal("")).optional(),
  hostingOrdered: z.boolean().optional(),
  hostingCpanelUsername: z
    .string()
    .max(255, "Username must be 255 characters or less")
    .or(z.literal(""))
    .optional(),
});

const createUserSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(6, "Minimum 6 characters"),
});

const maintenancePlanSchema = z.object({
  maintenancePlanName: z.string().optional(),
  maintenanceHoursPerMonth: z.number().min(0, "Hours must be zero or more").optional(),
  maintenanceCarryoverMode: z.enum(["carry", "none"]).optional(),
  maintenanceStartDate: z.string().optional(),
  maintenanceExpirationDate: z.string().optional(),
  maintenanceOrdered: z.boolean().optional(),
});

type MaintenancePlanInput = z.infer<typeof maintenancePlanSchema>;

const createTaskSchema = z.object({
  title: z.string().min(2, "Title is required"),
  type: z.string().optional(),
  status: z.string().optional(),
});

const createEntrySchema = z.object({
  date: z.string().min(1, "Date is required"),
  hours: z.number().int().min(0),
  minutes: z.number().int().min(0).max(59),
  taskId: z.string().optional(),
  isIncludedInPlan: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
});

type BasicInfoInput = z.infer<typeof basicInfoSchema>;
type WordpressInput = z.infer<typeof wordpressSchema>;
type HostingInput = z.infer<typeof hostingSchema>;
type CreateUserInput = z.infer<typeof createUserSchema>;
type CreateTaskInput = z.infer<typeof createTaskSchema>;
type CreateEntryInput = z.infer<typeof createEntrySchema>;

function formatDurationHM(hoursFloat: number): string {
  if (!Number.isFinite(hoursFloat) || hoursFloat <= 0) return "0h";
  const totalMinutes = Math.round(hoursFloat * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) return `${h}h`;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function extractGa4NumericId(propertyId?: string | null) {
  if (!propertyId) return "";
  const match = propertyId.match(/properties\/(.+)/);
  return match ? match[1] : propertyId;
}

function formatGa4Status(status?: string | null) {
  if (!status) return "Not configured";
  if (status === "ok") return "OK";
  if (status === "error: permission_denied") return "Permission denied";
  if (status === "error: property_not_found") return "Property not found";
  if (status === "error: not_configured") return "Not configured";
  if (status.startsWith("error:")) return status.replace("error:", "").trim();
  return status;
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function normalizeCarryoverMode(mode?: string | null): "carry" | "none" {
  if (mode === "carry" || mode === "none") {
    return mode;
  }
  return "none";
}

function toOptionalNumber(value: string): number | undefined {
  if (value === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export default function TenantDetailPage() {
  const params = useParams<{ id: string }>();
  const tenantId = params?.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status: authStatus, user } = useAuth();
  const canQuery = authStatus === "authenticated" && user?.role === "admin";
  const [basicInfoMessage, setBasicInfoMessage] = useState<string | null>(null);
  const [wordpressMessage, setWordpressMessage] = useState<string | null>(null);
  const [hostingMessage, setHostingMessage] = useState<string | null>(null);
  const [userMessage, setUserMessage] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<{ type: "success" | "error"; text: string }>();
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isDeleteUserDialogOpen, setIsDeleteUserDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<TenantUser | null>(null);
  const [deleteUserError, setDeleteUserError] = useState<string | null>(null);
  const [isDeleteTenantDialogOpen, setIsDeleteTenantDialogOpen] = useState(false);
  const [deleteTenantError, setDeleteTenantError] = useState<string | null>(null);
  const [maintenancePlanMessage, setMaintenancePlanMessage] = useState<string | null>(null);
  const [createTaskMessage, setCreateTaskMessage] = useState<string | null>(null);
  const [createEntryMessage, setCreateEntryMessage] = useState<string | null>(null);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([]);
  const [newFeatureLabel, setNewFeatureLabel] = useState("");
  const [featureMessage, setFeatureMessage] = useState<string | null>(null);
  const [featureError, setFeatureError] = useState<string | null>(null);
  const [ga4PropertyInput, setGa4PropertyInput] = useState("");
  const [ga4SaveMessage, setGa4SaveMessage] = useState<string | null>(null);
  const [ga4TestMessage, setGa4TestMessage] = useState<string | null>(null);
  const [ga4TestSample, setGa4TestSample] = useState<{ users?: number; sessions?: number } | null>(
    null,
  );

  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery<TenantDetail>({
    queryKey: ["admin", "tenants", tenantId],
    queryFn: () =>
      apiFetch<TenantDetail>(
        `/admin/tenants/${tenantId}`,
        { method: "GET" },
        true,
      ),
    enabled: Boolean(tenantId) && canQuery,
  });

  const {
    data: maintenanceCycle,
    isLoading: isMaintenanceLoading,
    isError: isMaintenanceError,
    error: maintenanceError,
  } = useQuery<MaintenanceCycle>({
    queryKey: ["admin", "tenants", tenantId, "maintenance"],
    queryFn: () =>
      apiFetch<MaintenanceCycle>(
        `/maintenance/admin/tenants/${tenantId}/current`,
        { method: "GET" },
        true,
      ),
    enabled: Boolean(tenantId) && canQuery,
  });

  const {
    data: tasks,
    isLoading: isTasksLoading,
    isError: isTasksError,
  } = useQuery<MaintenanceTask[]>({
    queryKey: ["admin", "tenants", tenantId, "maintenance", "tasks"],
    queryFn: () =>
      apiFetch<MaintenanceTask[]>(
        `/maintenance/admin/tenants/${tenantId}/tasks`,
        { method: "GET" },
        true,
      ),
    enabled: Boolean(tenantId) && canQuery,
  });

  const {
    data: entries,
    isLoading: isEntriesLoading,
    isError: isEntriesError,
  } = useQuery<MaintenanceEntry[]>({
    queryKey: ["admin", "tenants", tenantId, "maintenance", "entries"],
    queryFn: () =>
      apiFetch<MaintenanceEntry[]>(
        `/maintenance/admin/tenants/${tenantId}/entries`,
        { method: "GET" },
        true,
      ),
    enabled: Boolean(tenantId) && canQuery,
  });

  const {
    data: featureLibrary,
    isLoading: isFeatureLibraryLoading,
    isError: isFeatureLibraryError,
  } = useQuery<MaintenanceFeatureItem[]>({
    queryKey: ["maintenance", "admin", "features"],
    queryFn: () =>
      apiFetch<MaintenanceFeatureItem[]>(
        `/maintenance/admin/features`,
        { method: "GET" },
        true,
      ),
    enabled: canQuery,
  });

  const {
    data: tenantFeatureSelection,
    isLoading: isTenantFeaturesLoading,
    isError: isTenantFeaturesError,
  } = useQuery<TenantFeatureSelection>({
    queryKey: ["admin", "tenants", tenantId, "maintenance", "features", "selection"],
    queryFn: () =>
      apiFetch<TenantFeatureSelection>(
        `/maintenance/admin/tenants/${tenantId}/features`,
        { method: "GET" },
        true,
      ),
    enabled: Boolean(tenantId) && canQuery,
  });

  const sanitize = (value?: string | null) =>
    value && value.trim().length > 0 ? value.trim() : undefined;

  const basicInfoForm = useForm<BasicInfoInput>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      name: "",
      websiteUrl: "",
      contactEmail: "",
    },
  });

  const wordpressForm = useForm<WordpressInput>({
    resolver: zodResolver(wordpressSchema),
    defaultValues: {
      wpSiteUrl: "",
      wpApiUser: "",
      wpAppPassword: "",
    },
  });

  const hostingForm = useForm<HostingInput>({
    resolver: zodResolver(hostingSchema),
    defaultValues: {
      hostingExpirationDate: "",
      hostingOrdered: false,
    hostingCpanelUsername: "",
    },
  });

  const userForm = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const maintenancePlanForm = useForm<MaintenancePlanInput>({
    resolver: zodResolver(maintenancePlanSchema),
    defaultValues: {
      maintenancePlanName: "",
      maintenanceHoursPerMonth: undefined,
      maintenanceCarryoverMode: "none",
      maintenanceStartDate: "",
      maintenanceExpirationDate: "",
      maintenanceOrdered: false,
    },
  });

  const createTaskForm = useForm<CreateTaskInput>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: "",
      type: "routine",
      status: "open",
    },
  });

  const createEntryForm = useForm<CreateEntryInput>({
    resolver: zodResolver(createEntrySchema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      hours: 0,
      minutes: 0,
      taskId: undefined,
      isIncludedInPlan: true,
      notes: "",
    },
  });

  useEffect(() => {
    if (!data) return;
    basicInfoForm.reset({
      name: data.name ?? "",
      websiteUrl: data.websiteUrl ?? "",
      contactEmail: data.contactEmail ?? "",
    });
    wordpressForm.reset({
      wpSiteUrl: data.wpSiteUrl ?? "",
      wpApiUser: data.wpApiUser ?? "",
      wpAppPassword: data.wpAppPassword ?? "",
    });
    hostingForm.reset({
      hostingExpirationDate: data.hostingExpirationDate
        ? data.hostingExpirationDate.slice(0, 10)
        : "",
      hostingOrdered: data.hostingOrdered ?? false,
      hostingCpanelUsername: data.hostingCpanelUsername ?? "",
    });
    maintenancePlanForm.reset({
      maintenancePlanName: data.maintenancePlanName ?? "",
      maintenanceHoursPerMonth: data.maintenanceHoursPerMonth ?? undefined,
      maintenanceCarryoverMode: normalizeCarryoverMode(data.maintenanceCarryoverMode),
      maintenanceStartDate: data.maintenanceStartDate
        ? data.maintenanceStartDate.slice(0, 10)
        : "",
      maintenanceExpirationDate: data.maintenanceExpirationDate
        ? data.maintenanceExpirationDate.slice(0, 10)
        : "",
      maintenanceOrdered: data.maintenanceOrdered ?? false,
    });
    setGa4PropertyInput(extractGa4NumericId(data.ga4PropertyId));
    setGa4SaveMessage(null);
  }, [data, basicInfoForm, wordpressForm, hostingForm, maintenancePlanForm]);

  useEffect(() => {
    if (!tenantFeatureSelection?.selectedFeatureIds) return;
    setSelectedFeatureIds(tenantFeatureSelection.selectedFeatureIds);
  }, [tenantFeatureSelection]);

  const genericUpdateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiFetch(
        `/admin/tenants/${tenantId}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
        true,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants", tenantId] }),
  });

  const sendHostingEmailMutation = useMutation({
    mutationFn: () => {
      if (!tenantId) {
        throw new Error("Tenant not ready yet.");
      }
      return apiFetch<{ ok: true }>(
        `/admin/tenants/${tenantId}/hosting/send-info-email`,
        {
          method: "POST",
        },
        true,
      );
    },
    onSuccess: () => {
      toast.success("Hosting info email sent.");
    },
    onError: (error: unknown) => {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to send hosting info email.";
      toast.error(message);
    },
  });

  const sendWelcomeEmailMutation = useMutation<{ ok: true }, unknown, string>({
    mutationFn: (userId: string) =>
      apiFetch<{ ok: true }>(
        `/admin/users/${userId}/send-welcome`,
        {
          method: "POST",
        },
        true,
      ),
    onSuccess: () => {
      toast.success("Welcome email sent.");
    },
    onError: (error: unknown) => {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to send welcome email.";
      toast.error(message);
    },
  });

  const testConnectionMutation = useMutation<WordpressConnectionTestResult>({
    mutationFn: () =>
      apiFetch<WordpressConnectionTestResult>(
        `/wordpress/admin/tenants/${tenantId}/test`,
        {
          method: "GET",
        },
        true,
      ),
    onSuccess: (result) => {
      const eventsText = result.events.ok
        ? `Events endpoint OK (${result.events.count ?? 0} occurrences between ${result.events.start} and ${result.events.end}).`
        : `Events endpoint issue: ${result.events.message ?? "Unknown error"}.`;
      setTestMessage({
        type: result.events.ok ? "success" : "error",
        text: `Connection OK — ${result.postsCount} posts found. ${eventsText}`,
      });
    },
    onError: (err) => {
      setTestMessage({
        type: "error",
        text:
          err instanceof ApiError ? err.message : "Failed to test WordPress connection.",
      });
    },
  });

  const ga4TestMutation = useMutation({
    mutationFn: () =>
      apiFetch<{
        ok: boolean;
        message: string;
        status: string;
        sample?: { users?: number; sessions?: number };
      }>(
        `/ga4/admin/tenants/${tenantId}/test`,
        {
          method: "GET",
        },
        true,
      ),
    onSuccess: (result) => {
      setGa4TestMessage(result.message);
      setGa4TestSample(result.sample ?? null);
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants", tenantId] });
    },
    onError: (err) => {
      const message =
        err instanceof ApiError ? err.message : "Failed to test analytics connection.";
      setGa4TestMessage(message);
      setGa4TestSample(null);
    },
  });

  const handleSaveGa4Property = () => {
    if (!tenantId) return;
    const trimmed = ga4PropertyInput.trim();
    const payload =
      trimmed.length === 0
        ? { ga4PropertyId: null }
        : {
            ga4PropertyId: trimmed.startsWith("properties/")
              ? trimmed
              : `properties/${trimmed}`,
          };
    setGa4SaveMessage(null);
    genericUpdateMutation.mutate(payload, {
      onSuccess: () => {
        setGa4SaveMessage("GA4 property ID saved.");
        queryClient.invalidateQueries({ queryKey: ["admin", "tenants", tenantId] });
      },
      onError: (err) => {
        const message =
          err instanceof ApiError ? err.message : "Failed to save GA4 property.";
        setGa4SaveMessage(message);
      },
    });
  };

  const handleTestGa4 = () => {
    if (!data?.ga4PropertyId) {
      setGa4TestMessage("Add a GA4 property ID before testing.");
      setGa4TestSample(null);
      return;
    }
    setGa4TestMessage(null);
    setGa4TestSample(null);
    ga4TestMutation.mutate();
  };

  const addUserMutation = useMutation({
    mutationFn: (payload: CreateUserInput) =>
      apiFetch(
        `/admin/tenants/${tenantId}/users`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        true,
      ),
    onSuccess: () => {
      setUserMessage("User added.");
      userForm.reset();
      setIsUserDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants", tenantId] });
    },
    onError: (err) => {
      setUserMessage(
        err instanceof ApiError ? err.message : "Failed to create user.",
      );
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async () => {
      if (!userToDelete) return;
      return apiFetch(
        `/admin/tenants/${tenantId}/users/${userToDelete.id}`,
        {
          method: "DELETE",
        },
        true,
      );
    },
    onSuccess: () => {
      setIsDeleteUserDialogOpen(false);
      setUserToDelete(null);
      setDeleteUserError(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants", tenantId] });
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Failed to delete user";
      setDeleteUserError(msg);
    },
  });

  const deleteTenantMutation = useMutation({
    mutationFn: () =>
      apiFetch(
        `/admin/tenants/${tenantId}`,
        {
          method: "DELETE",
        },
        true,
      ),
    onSuccess: () => {
      setIsDeleteTenantDialogOpen(false);
      setDeleteTenantError(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
      router.push("/admin/tenants");
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Failed to delete tenant";
      setDeleteTenantError(msg);
    },
  });


  const createTaskMutation = useMutation({
    mutationFn: (payload: CreateTaskInput) =>
      apiFetch<MaintenanceTask>(
        `/maintenance/admin/tenants/${tenantId}/tasks`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        true,
      ),
    onSuccess: () => {
      setCreateTaskMessage("Task created.");
      createTaskForm.reset({ title: "", type: "routine", status: "open" });
      queryClient.invalidateQueries({
        queryKey: ["admin", "tenants", tenantId, "maintenance", "tasks"],
      });
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Failed to create task.";
      setCreateTaskMessage(msg);
    },
  });

  const createEntryMutation = useMutation({
    mutationFn: async (payload: CreateEntryInput) => {
      const totalHours = (payload.hours ?? 0) + (payload.minutes ?? 0) / 60;
      if (totalHours <= 0) {
        throw new Error("Please enter at least a few minutes of work.");
      }
      return apiFetch(
        `/maintenance/admin/tenants/${tenantId}/entries`,
        {
          method: "POST",
          body: JSON.stringify({
            date: payload.date,
            durationHours: totalHours,
            taskId:
              payload.taskId && payload.taskId.trim().length > 0 ? payload.taskId : undefined,
            isIncludedInPlan: payload.isIncludedInPlan ?? true,
            notes: payload.notes?.trim() || undefined,
          }),
        },
        true,
      );
    },
    onSuccess: () => {
      setCreateEntryMessage("Time entry created.");
      createEntryForm.reset({
        date: new Date().toISOString().slice(0, 10),
        hours: 0,
        minutes: 0,
        taskId: undefined,
        isIncludedInPlan: true,
        notes: "",
      });
      queryClient.invalidateQueries({
        queryKey: ["admin", "tenants", tenantId, "maintenance", "entries"],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin", "tenants", tenantId, "maintenance"],
      });
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Failed to create time entry.";
      setCreateEntryMessage(msg);
    },
  });

  const saveFeaturesMutation = useMutation({
    mutationFn: (featureIdsToSave: string[]) =>
      apiFetch(
        `/maintenance/admin/tenants/${tenantId}/features`,
        {
          method: "PUT",
          body: JSON.stringify({ featureIds: featureIdsToSave }),
        },
        true,
      ),
    onSuccess: () => {
      setFeatureMessage("Features updated.");
      setFeatureError(null);
      queryClient.invalidateQueries({
        queryKey: ["admin", "tenants", tenantId, "maintenance", "features", "selection"],
      });
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Failed to update features.";
      setFeatureError(msg);
      setFeatureMessage(null);
    },
  });

  const createFeatureForTenantMutation = useMutation({
    mutationFn: (payload: { label: string }) =>
      apiFetch(
        `/maintenance/admin/tenants/${tenantId}/features`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        true,
      ),
    onSuccess: () => {
      setFeatureMessage("Feature added and assigned.");
      setFeatureError(null);
      setNewFeatureLabel("");
      queryClient.invalidateQueries({ queryKey: ["maintenance", "admin", "features"] });
      queryClient.invalidateQueries({
        queryKey: ["admin", "tenants", tenantId, "maintenance", "features", "selection"],
      });
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Failed to add feature.";
      setFeatureError(msg);
      setFeatureMessage(null);
    },
  });
  const handleMaintenancePlanSubmit = maintenancePlanForm.handleSubmit((values) => {
    setMaintenancePlanMessage(null);
    const payload = {
      maintenancePlanName: values.maintenancePlanName ?? null,
      maintenanceHoursPerMonth:
        values.maintenanceHoursPerMonth === undefined ? null : values.maintenanceHoursPerMonth,
      maintenanceCarryoverMode: values.maintenanceCarryoverMode ?? "none",
      maintenanceStartDate:
        values.maintenanceStartDate && values.maintenanceStartDate.length > 0
          ? values.maintenanceStartDate
          : null,
      maintenanceExpirationDate:
        values.maintenanceExpirationDate && values.maintenanceExpirationDate.length > 0
          ? values.maintenanceExpirationDate
          : null,
      maintenanceOrdered: Boolean(values.maintenanceOrdered),
    };
    genericUpdateMutation.mutate(payload, {
      onSuccess: () => setMaintenancePlanMessage("Plan saved."),
      onError: (err) =>
        setMaintenancePlanMessage(
          err instanceof ApiError ? err.message : "Failed to save maintenance plan.",
        ),
    });
  });

  const handleFeatureToggle = (featureId: string) => {
    setFeatureMessage(null);
    setFeatureError(null);
    setSelectedFeatureIds((prev) =>
      prev.includes(featureId) ? prev.filter((id) => id !== featureId) : [...prev, featureId],
    );
  };

  const handleSaveFeatures = () => {
    saveFeaturesMutation.mutate(selectedFeatureIds);
  };

  const handleAddFeature = () => {
    const trimmed = newFeatureLabel.trim();
    if (!trimmed) {
      setFeatureError("Enter a feature name before adding.");
      setFeatureMessage(null);
      return;
    }
    createFeatureForTenantMutation.mutate({ label: trimmed });
  };

  const handleBasicInfoSubmit = basicInfoForm.handleSubmit((values) => {
    setBasicInfoMessage(null);
    const payload = {
      name: values.name,
      websiteUrl: sanitize(values.websiteUrl),
      contactEmail: sanitize(values.contactEmail),
    };
    genericUpdateMutation.mutate(payload, {
      onSuccess: () => setBasicInfoMessage("Saved."),
      onError: (err) =>
        setBasicInfoMessage(
          err instanceof ApiError ? err.message : "Failed to save info.",
        ),
    });
  });

  const handleWordpressSubmit = wordpressForm.handleSubmit((values) => {
    setWordpressMessage(null);
    const payload = {
      wpSiteUrl: sanitize(values.wpSiteUrl),
      wpApiUser: sanitize(values.wpApiUser),
      wpAppPassword: sanitize(values.wpAppPassword),
    };
    genericUpdateMutation.mutate(payload, {
      onSuccess: () => setWordpressMessage("Saved."),
      onError: (err) =>
        setWordpressMessage(
          err instanceof ApiError ? err.message : "Failed to save WordPress settings.",
        ),
    });
  });

  const handleHostingSubmit = hostingForm.handleSubmit((values) => {
    setHostingMessage(null);
    const payload = {
      hostingExpirationDate: values.hostingExpirationDate
        ? values.hostingExpirationDate
        : null,
      hostingOrdered: Boolean(values.hostingOrdered),
      hostingCpanelUsername: values.hostingCpanelUsername?.trim() ?? "",
    };
    genericUpdateMutation.mutate(payload, {
      onSuccess: () => setHostingMessage("Saved."),
      onError: (err) =>
        setHostingMessage(
          err instanceof ApiError
            ? err.message
            : "Failed to save hosting & maintenance.",
        ),
    });
  });

  const userList = useMemo(() => data?.users ?? [], [data]);

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">
              Tenant Detail
            </p>
            <h1 className="text-3xl font-semibold">
              {data?.name ?? "Loading tenant..."}
            </h1>
          </div>
          <Button variant="outline" asChild>
            <Link href="/admin/tenants">Back to tenants</Link>
          </Button>
        </div>

        {isLoading && (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              Loading tenant data...
            </CardContent>
          </Card>
        )}

        {isError && (
          <Card>
            <CardContent className="py-6 text-sm text-destructive">
              {error instanceof ApiError
                ? error.message
                : "Failed to load tenant."}
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && data && (
          <>
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="flex flex-wrap gap-2">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="hosting">Hosting</TabsTrigger>
                <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
                <TabsTrigger value="wordpress">WordPress</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
                <TabsTrigger value="users">Users</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Basic Info</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Form {...basicInfoForm}>
                      <form onSubmit={handleBasicInfoSubmit} className="space-y-4">
                    <FormField
                      control={basicInfoForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={basicInfoForm.control}
                      name="websiteUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={basicInfoForm.control}
                      name="contactEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Email</FormLabel>
                          <FormControl>
                            <Input placeholder="owner@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex items-center gap-3">
                      <Button type="submit" disabled={genericUpdateMutation.isPending}>
                        {genericUpdateMutation.isPending ? "Saving..." : "Save changes"}
                      </Button>
                      {basicInfoMessage && (
                        <p className="text-sm text-muted-foreground">{basicInfoMessage}</p>
                      )}
                    </div>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="wordpress" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>WordPress Integration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Form {...wordpressForm}>
                      <form onSubmit={handleWordpressSubmit} className="space-y-4">
                    <FormField
                      control={wordpressForm.control}
                      name="wpSiteUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Site URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://wp.example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={wordpressForm.control}
                      name="wpApiUser"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>API User</FormLabel>
                          <FormControl>
                            <Input placeholder="wp-api-user" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={wordpressForm.control}
                      name="wpAppPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Application Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="********" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="submit"
                        disabled={genericUpdateMutation.isPending}
                      >
                        {genericUpdateMutation.isPending ? "Saving..." : "Save changes"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setTestMessage(undefined);
                          testConnectionMutation.mutate();
                        }}
                        disabled={testConnectionMutation.isPending}
                      >
                        {testConnectionMutation.isPending
                          ? "Testing..."
                          : "Test WordPress Connection"}
                      </Button>
                      {wordpressMessage && (
                        <p className="text-sm text-muted-foreground">{wordpressMessage}</p>
                      )}
                    </div>
                      </form>
                    </Form>
                    {testMessage && (
                      <p
                        className={`text-sm ${
                          testMessage.type === "success" ? "text-emerald-600" : "text-destructive"
                        }`}
                      >
                        {testMessage.text}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="analytics" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Analytics (GA4)</CardTitle>
                    <CardDescription>Configure Google Analytics 4 for this tenant.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      {data.ga4PropertyId ? (
                        <p>
                          Last status: <span className="text-foreground">{formatGa4Status(data.ga4LastSyncStatus)}</span> · Last
                          checked: <span className="text-foreground">{formatDateTime(data.ga4ConnectedAt)}</span>
                        </p>
                      ) : (
                        <p>Analytics not configured for this tenant.</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="ga4-property-id" className="text-sm font-medium text-foreground">
                        GA4 Property ID
                      </label>
                      <Input
                        id="ga4-property-id"
                        value={ga4PropertyInput}
                        onChange={(event) => {
                          setGa4PropertyInput(event.target.value);
                          setGa4SaveMessage(null);
                        }}
                        placeholder="123456789"
                      />
                      <p className="text-xs text-muted-foreground">
                        You can find this in Google Analytics under Admin → Property details. Enter only the numeric ID.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button type="button" onClick={handleSaveGa4Property} disabled={genericUpdateMutation.isPending}>
                        {genericUpdateMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleTestGa4}
                        disabled={!data.ga4PropertyId || ga4TestMutation.isPending}
                      >
                        {ga4TestMutation.isPending ? "Testing..." : "Test connection"}
                      </Button>
                    </div>
                    {ga4SaveMessage && (
                      <p className="text-sm text-muted-foreground">
                        {ga4SaveMessage}
                      </p>
                    )}
                    {ga4TestMessage && (
                      <p className="text-sm text-muted-foreground">
                        {ga4TestMessage}
                      </p>
                    )}
                    {ga4TestSample && (
                      <p className="text-xs text-muted-foreground">
                        Sample data (last 7 days): {ga4TestSample.users ?? 0} users ·{" "}
                        {ga4TestSample.sessions ?? 0} sessions
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="hosting" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Hosting details</CardTitle>
                    <CardDescription>Manage hosting expiration and order status.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Form {...hostingForm}>
                      <form onSubmit={handleHostingSubmit} className="space-y-4">
                        <FormField
                          control={hostingForm.control}
                          name="hostingExpirationDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Hosting expiration</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                  <FormField
                    control={hostingForm.control}
                    name="hostingCpanelUsername"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>cPanel / WHM username</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. client123"
                            value={field.value ?? ""}
                            onChange={(event) => field.onChange(event.target.value)}
                          />
                        </FormControl>
                        <FormDescription>
                          This must match the WHM account username configured on the hosting server.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                        <FormField
                          control={hostingForm.control}
                          name="hostingOrdered"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2">
                              <FormControl>
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border border-border"
                                  checked={field.value ?? false}
                                  onChange={(event) => field.onChange(event.target.checked)}
                                />
                              </FormControl>
                              <FormLabel className="mt-0">Hosting ordered</FormLabel>
                            </FormItem>
                          )}
                        />
                        <div className="flex items-center gap-3">
                          <Button type="submit" disabled={genericUpdateMutation.isPending}>
                            {genericUpdateMutation.isPending ? "Saving..." : "Save changes"}
                          </Button>
                          {hostingMessage && (
                            <p className="text-sm text-muted-foreground">{hostingMessage}</p>
                          )}
                        </div>
                      </form>
                    </Form>
                    <p className="text-xs text-muted-foreground">
                      Maintenance plan settings now live under the Maintenance tab.
                    </p>
                    <div className="rounded-lg border border-dashed border-border p-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Send hosting info email</p>
                        <p className="text-xs text-muted-foreground">
                          Emails the latest plan summary and cPanel link to the tenant&apos;s contacts.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        className="mt-3"
                        disabled={
                          sendHostingEmailMutation.isPending ||
                          !tenantId ||
                          !data?.hostingCpanelUsername
                        }
                        onClick={() => sendHostingEmailMutation.mutate()}
                      >
                        {sendHostingEmailMutation.isPending
                          ? "Sending..."
                          : "Send Hosting Info Email"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="users" className="space-y-4">
                <Card>
                  <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle>Users</CardTitle>
                    <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>Add User</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Client User</DialogTitle>
                          <DialogDescription>
                            Provide credentials for the new client user.
                          </DialogDescription>
                        </DialogHeader>
                        <Form {...userForm}>
                          <form
                            onSubmit={userForm.handleSubmit((values) =>
                              addUserMutation.mutate(values),
                            )}
                            className="space-y-4"
                          >
                            <FormField
                              control={userForm.control}
                              name="email"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Email</FormLabel>
                                  <FormControl>
                                    <Input type="email" placeholder="client@example.com" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={userForm.control}
                              name="password"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Password</FormLabel>
                                  <FormControl>
                                    <Input type="password" placeholder="Minimum 6 characters" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            {userMessage && (
                              <p className="text-sm text-destructive">{userMessage}</p>
                            )}
                            <DialogFooter>
                              <Button type="submit" disabled={addUserMutation.isPending}>
                                {addUserMutation.isPending ? "Creating..." : "Create user"}
                              </Button>
                            </DialogFooter>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    {userList.length === 0 && (
                      <p>No users yet. Add a user to grant dashboard access.</p>
                    )}
                    {userList.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between rounded border border-border px-3 py-2"
                      >
                        <div>
                          <p className="text-foreground">{user.email}</p>
                          <p className="text-xs uppercase text-muted-foreground">{user.role}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              Actions
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {user.role?.toLowerCase() === "client" && (
                              <DropdownMenuItem
                                disabled={
                                  sendWelcomeEmailMutation.isPending &&
                                  sendWelcomeEmailMutation.variables === user.id
                                }
                                onSelect={() => {
                                  sendWelcomeEmailMutation.mutate(user.id);
                                }}
                              >
                                {sendWelcomeEmailMutation.isPending &&
                                sendWelcomeEmailMutation.variables === user.id
                                  ? "Sending welcome..."
                                  : "Send welcome email"}
                              </DropdownMenuItem>
                            )}
                            {user.role?.toLowerCase() === "client" && <DropdownMenuSeparator />}
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() => {
                            setUserToDelete(user);
                            setDeleteUserError(null);
                            setIsDeleteUserDialogOpen(true);
                          }}
                        >
                              Delete user
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}

                    <Dialog
                      open={isDeleteUserDialogOpen}
                      onOpenChange={(open: boolean) => {
                        setIsDeleteUserDialogOpen(open);
                        if (!open) {
                          setUserToDelete(null);
                          setDeleteUserError(null);
                        }
                      }}
                    >
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Delete user</DialogTitle>
                          <DialogDescription>
                            This action cannot be undone. The user will permanently lose access.
                          </DialogDescription>
                        </DialogHeader>
                        {deleteUserError && (
                          <p className="text-sm text-destructive">{deleteUserError}</p>
                        )}
                        <DialogFooter className="pt-4 space-x-2">
                          <Button
                            variant="outline"
                            onClick={() => setIsDeleteUserDialogOpen(false)}
                            disabled={deleteUserMutation.isPending}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => deleteUserMutation.mutate()}
                            disabled={deleteUserMutation.isPending}
                          >
                            {deleteUserMutation.isPending ? "Deleting..." : "Delete user"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="maintenance" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Maintenance Plan</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Form {...maintenancePlanForm}>
                      <form onSubmit={handleMaintenancePlanSubmit} className="space-y-4">
                    <FormField
                      control={maintenancePlanForm.control}
                      name="maintenancePlanName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Plan name</FormLabel>
                          <FormControl>
                            <Input placeholder="Premium Care" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={maintenancePlanForm.control}
                      name="maintenanceHoursPerMonth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hours per month</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              value={field.value ?? ""}
                              onChange={(event) => field.onChange(toOptionalNumber(event.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={maintenancePlanForm.control}
                      name="maintenanceCarryoverMode"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <FormControl>
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border border-border"
                              checked={field.value === "carry"}
                              onChange={(event) => field.onChange(event.target.checked ? "carry" : "none")}
                            />
                          </FormControl>
                          <FormLabel className="mt-0">Allow unused hours to carry over</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={maintenancePlanForm.control}
                      name="maintenanceOrdered"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <FormControl>
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border border-border"
                              checked={field.value ?? false}
                              onChange={(event) => field.onChange(event.target.checked)}
                            />
                          </FormControl>
                          <FormLabel className="mt-0">Maintenance ordered</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={maintenancePlanForm.control}
                      name="maintenanceStartDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Plan start date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={maintenancePlanForm.control}
                      name="maintenanceExpirationDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Plan expiration date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex items-center gap-3">
                      <Button type="submit" disabled={genericUpdateMutation.isPending}>
                        {genericUpdateMutation.isPending ? "Saving..." : "Save plan"}
                      </Button>
                      {maintenancePlanMessage && (
                        <p className="text-sm text-muted-foreground">{maintenancePlanMessage}</p>
                      )}
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Maintenance plan features</CardTitle>
                <CardDescription>Select which services are included for this tenant.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                {(isFeatureLibraryLoading || isTenantFeaturesLoading) && <p>Loading features…</p>}
                {!isFeatureLibraryLoading && isFeatureLibraryError && (
                  <p className="text-destructive">Failed to load feature library.</p>
                )}
                {!isTenantFeaturesLoading && isTenantFeaturesError && (
                  <p className="text-destructive">Failed to load tenant feature selection.</p>
                )}
                {!isFeatureLibraryLoading &&
                  !isFeatureLibraryError &&
                  featureLibrary &&
                  featureLibrary.length === 0 && (
                    <p>No reusable features have been created yet.</p>
                  )}
                {!isFeatureLibraryLoading &&
                  !isFeatureLibraryError &&
                  featureLibrary &&
                  featureLibrary.length > 0 && (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {featureLibrary.map((feature) => {
                        const checked = selectedFeatureIds.includes(feature.id);
                        return (
                          <label
                            key={feature.id}
                            className="flex cursor-pointer items-start gap-3 rounded border border-border p-3"
                          >
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 rounded border border-border"
                              checked={checked}
                              onChange={() => handleFeatureToggle(feature.id)}
                            />
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{feature.label}</p>
                              {feature.description && (
                                <p className="text-xs text-muted-foreground">{feature.description}</p>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveFeatures}
                    disabled={saveFeaturesMutation.isPending}
                  >
                    {saveFeaturesMutation.isPending ? "Saving..." : "Save features"}
                  </Button>
                  {featureMessage && <p className="text-xs text-muted-foreground">{featureMessage}</p>}
                  {featureError && <p className="text-xs text-destructive">{featureError}</p>}
                </div>

                <div className="space-y-2 border-t border-border pt-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Add a new feature
                  </p>
                  <div className="flex flex-col gap-3 md:flex-row">
                    <Input
                      placeholder="e.g. Weekly off-site backups"
                      value={newFeatureLabel}
                      onChange={(event) => setNewFeatureLabel(event.target.value)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddFeature}
                      disabled={createFeatureForTenantMutation.isPending}
                    >
                      {createFeatureForTenantMutation.isPending ? "Adding..." : "Add & assign"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Maintenance tasks</CardTitle>
                <CardDescription>High-level items you&apos;ve worked on for this client.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <Form {...createTaskForm}>
                  <form
                    onSubmit={createTaskForm.handleSubmit((values) => createTaskMutation.mutate(values))}
                    className="space-y-3"
                  >
                    <FormField
                      control={createTaskForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. November updates" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createTaskForm.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type</FormLabel>
                          <FormControl>
                            <Input placeholder="routine / extra" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createTaskForm.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <FormControl>
                            <Input placeholder="open / in-progress / completed" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex items-center gap-3">
                      <Button type="submit" size="sm" disabled={createTaskMutation.isPending}>
                        {createTaskMutation.isPending ? "Creating..." : "Add task"}
                      </Button>
                      {createTaskMessage && (
                        <p className="text-xs text-muted-foreground">{createTaskMessage}</p>
                      )}
                    </div>
                  </form>
                </Form>

                <div className="space-y-2 pt-2">
                  {isTasksLoading && (
                    <p className="text-xs text-muted-foreground">Loading tasks…</p>
                  )}
                  {isTasksError && (
                    <p className="text-xs text-destructive">Failed to load tasks.</p>
                  )}
                  {!isTasksLoading && !isTasksError && tasks && tasks.length === 0 && (
                    <p className="text-xs text-muted-foreground">No tasks yet.</p>
                  )}
                  {!isTasksLoading &&
                    !isTasksError &&
                    tasks &&
                    tasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between rounded border border-border px-3 py-2"
                      >
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium text-foreground">{task.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {task.type} · {task.status}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>This Month&apos;s Usage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                {isMaintenanceLoading && <p>Loading maintenance usage...</p>}
                {isMaintenanceError && (
                  <p className="text-destructive">
                    {maintenanceError instanceof ApiError
                      ? maintenanceError.message
                      : "Failed to load maintenance usage."}
                  </p>
                )}
                {!isMaintenanceLoading && !isMaintenanceError && maintenanceCycle && (
                  <div className="space-y-2 rounded border border-border p-4">
                    <p>
                      <span className="font-medium text-foreground">Month:</span> {maintenanceCycle.month}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Total hours:</span>{" "}
                      {(
                        (maintenanceCycle.baseHours ?? 0) + (maintenanceCycle.carriedHours ?? 0)
                      ).toFixed(1)}
                      h
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Used hours:</span>{" "}
                      {(maintenanceCycle.usedHours ?? 0).toFixed(1)}h
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Remaining:</span>{" "}
                      {(
                        Math.max(
                          0,
                          (maintenanceCycle.baseHours ?? 0) +
                            (maintenanceCycle.carriedHours ?? 0) -
                            (maintenanceCycle.usedHours ?? 0),
                        )
                      ).toFixed(1)}
                      h
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Plan hours:</span>{" "}
                      {(maintenanceCycle.baseHours ?? 0).toFixed(1)}h
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Carried over:</span>{" "}
                      {(maintenanceCycle.carriedHours ?? 0).toFixed(1)}h
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Time entries (this month)</CardTitle>
                <CardDescription>Log work and keep your maintenance hours up to date.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <Form {...createEntryForm}>
                  <form
                    onSubmit={createEntryForm.handleSubmit((values) => createEntryMutation.mutate(values))}
                    className="space-y-3"
                  >
                    <FormField
                      control={createEntryForm.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={createEntryForm.control}
                        name="hours"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hours</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={Number.isFinite(field.value) ? field.value : 0}
                                onChange={(event) => {
                                  const parsed = Math.floor(event.target.valueAsNumber);
                                  field.onChange(Number.isNaN(parsed) ? 0 : Math.max(0, parsed));
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createEntryForm.control}
                        name="minutes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Minutes</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                max="59"
                                step="1"
                                value={Number.isFinite(field.value) ? field.value : 0}
                                onChange={(event) => {
                                  const parsed = Math.floor(event.target.valueAsNumber);
                                  if (Number.isNaN(parsed)) {
                                    field.onChange(0);
                                    return;
                                  }
                                  const clamped = Math.min(59, Math.max(0, parsed));
                                  field.onChange(clamped);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={createEntryForm.control}
                      name="taskId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Task (optional)</FormLabel>
                          <FormControl>
                            <select
                              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              value={field.value ?? ""}
                              onChange={(event) => field.onChange(event.target.value || undefined)}
                            >
                              <option value="">No specific task</option>
                              {tasks?.map((task) => (
                                <option key={task.id} value={task.id}>
                                  {task.title}
                                </option>
                              ))}
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createEntryForm.control}
                      name="isIncludedInPlan"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-2">
                          <FormControl>
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border border-border"
                              checked={field.value ?? true}
                              onChange={(event) => field.onChange(event.target.checked)}
                            />
                          </FormControl>
                          <FormLabel className="mt-0">Count against plan hours</FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createEntryForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Short internal note" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex items-center gap-3">
                      <Button type="submit" size="sm" disabled={createEntryMutation.isPending}>
                        {createEntryMutation.isPending ? "Logging..." : "Log time"}
                      </Button>
                      {createEntryMessage && (
                        <p className="text-xs text-muted-foreground">{createEntryMessage}</p>
                      )}
                    </div>
                  </form>
                </Form>

                <div className="space-y-2 pt-2">
                  {isEntriesLoading && (
                    <p className="text-xs text-muted-foreground">Loading entries…</p>
                  )}
                  {isEntriesError && (
                    <p className="text-xs text-destructive">Failed to load entries.</p>
                  )}
                  {!isEntriesLoading && !isEntriesError && entries && entries.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No time logged yet for this month.
                    </p>
                  )}
                  {!isEntriesLoading &&
                    !isEntriesError &&
                    entries &&
                    entries.map((entry) => {
                      const taskTitle = tasks?.find((task) => task.id === entry.taskId)?.title;
                      return (
                        <div
                          key={entry.id}
                          className="flex flex-col rounded border border-border px-3 py-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-foreground">
                              {formatDurationHM(entry.durationHours)}
                            </span>
                            <span className="text-muted-foreground">
                              {new Date(entry.date).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                          {taskTitle && (
                            <p className="text-muted-foreground">Task: {taskTitle}</p>
                          )}
                          {entry.notes && (
                            <p className="text-muted-foreground">Notes: {entry.notes}</p>
                          )}
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>

              </TabsContent>
            </Tabs>

            {data.users.length === 0 && (
              <div className="mt-10">
                <Button
                  variant="destructive"
                  onClick={() => {
                    setDeleteTenantError(null);
                    setIsDeleteTenantDialogOpen(true);
                  }}
                >
                  Delete tenant
                </Button>
              </div>
            )}

            <Dialog
              open={isDeleteTenantDialogOpen}
              onOpenChange={(open: boolean) => {
                setIsDeleteTenantDialogOpen(open);
                if (!open) {
                  setDeleteTenantError(null);
                }
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete tenant</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone. This will permanently remove the tenant.
                  </DialogDescription>
                </DialogHeader>
                {deleteTenantError && (
                  <p className="text-sm text-destructive">{deleteTenantError}</p>
                )}
                <DialogFooter className="pt-4 space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsDeleteTenantDialogOpen(false)}
                    disabled={deleteTenantMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => deleteTenantMutation.mutate()}
                    disabled={deleteTenantMutation.isPending}
                  >
                    {deleteTenantMutation.isPending ? "Deleting..." : "Delete tenant"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}

