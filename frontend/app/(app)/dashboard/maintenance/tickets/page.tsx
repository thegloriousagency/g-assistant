"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useClientTickets, useCreateClientTicket } from "@/hooks/useTickets";
import type { Ticket, TicketStatus, TicketType } from "@/types/tickets";

const ticketTypeOptions: Array<{ value: TicketType; label: string; helper?: string }> = [
  { value: "MAINTENANCE", label: "Maintenance issue" },
  {
    value: "CONTENT_UPDATE",
    label: "Content update / text or image change",
    helper: "Include page URL, specific copy changes, and any assets we should use.",
  },
  { value: "BUG", label: "Bug / technical issue" },
  { value: "BILLING", label: "Billing / account question" },
  { value: "OTHER", label: "Other" },
];

const typeLabelMap = ticketTypeOptions.reduce<Record<TicketType, string>>((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {} as Record<TicketType, string>);

const statusLabelMap: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

const statusBadgeClass: Record<TicketStatus, string> = {
  OPEN: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  IN_PROGRESS: "bg-amber-50 text-amber-700 border border-amber-200",
  RESOLVED: "bg-blue-50 text-blue-700 border border-blue-200",
  CLOSED: "bg-slate-100 text-slate-700 border border-slate-200",
};

function formatDate(dateString: string) {
  const value = new Date(dateString);
  if (Number.isNaN(value.getTime())) return "Unknown";
  return value.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function TicketRow({ ticket }: { ticket: Ticket }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(`/dashboard/maintenance/tickets/${ticket.id}`)}
      className="w-full rounded-lg border border-border px-4 py-3 text-left transition hover:border-primary/50 hover:bg-muted/50"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-foreground">{ticket.title}</p>
            {ticket.hasUnreadForClient && (
              <span className="flex items-center gap-1 text-xs font-semibold text-destructive">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                New
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{typeLabelMap[ticket.type]}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              statusBadgeClass[ticket.status],
            )}
          >
            {statusLabelMap[ticket.status]}
          </span>
          <p className="text-muted-foreground">Updated {formatDate(ticket.lastMessageAt)}</p>
        </div>
      </div>
    </button>
  );
}

function NewRequestDialog({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
}) {
  const [type, setType] = useState<TicketType>("MAINTENANCE");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createTicket = useCreateClientTicket();

  const activeType = useMemo(
    () => ticketTypeOptions.find((option) => option.value === type),
    [type],
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Please provide a short title for your request.");
      return;
    }
    if (!description.trim()) {
      setError("Please describe what you need help with.");
      return;
    }
    try {
      await createTicket.mutateAsync({
        title: title.trim(),
        body: description.trim(),
        type,
      });
      setTitle("");
      setDescription("");
      setType("MAINTENANCE");
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn’t create the request. Please try again.",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New request</DialogTitle>
          <DialogDescription>
            Share maintenance issues, content updates, bugs, or billing questions.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="ticket-type">
              Request type
            </label>
            <select
              id="ticket-type"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={type}
              onChange={(event) => setType(event.target.value as TicketType)}
              disabled={createTicket.isPending}
              required
            >
              {ticketTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="ticket-title">
              Short title
            </label>
            <Input
              id="ticket-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Update homepage hero text"
              required
              disabled={createTicket.isPending}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="ticket-description">
              Describe your request
            </label>
            <textarea
              id="ticket-description"
              className="flex min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Share page URLs, copy changes, steps to reproduce, or any context we should know."
              required
              disabled={createTicket.isPending}
            />
            {activeType?.helper && (
              <p className="text-xs text-muted-foreground">{activeType.helper}</p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={createTicket.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createTicket.isPending}>
              {createTicket.isPending ? "Submitting…" : "Submit request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function MaintenanceTicketsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading, isError } = useClientTickets({
    page: 1,
    pageSize: 20,
  });
  const tickets = data?.items ?? [];

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Support requests</h1>
            <p className="text-sm text-muted-foreground">
              Send maintenance or content requests to The Glorious Agency.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>New Request</Button>
        </div>

        <section className="space-y-4">
          {isLoading && <p className="text-sm text-muted-foreground">Loading tickets…</p>}
          {isError && (
            <p className="text-sm text-destructive">
              We couldn’t load your tickets. Please refresh this page.
            </p>
          )}
          {!isLoading && !isError && tickets.length === 0 && (
            <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
              <p>You don’t have any requests yet.</p>
              <p className="mt-1">Click “New Request” to tell us what you need.</p>
            </div>
          )}
          {!isLoading && !isError && tickets.length > 0 && (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <TicketRow key={ticket.id} ticket={ticket} />
              ))}
            </div>
          )}
        </section>
      </div>
      <NewRequestDialog open={dialogOpen} setOpen={setDialogOpen} />
    </ProtectedRoute>
  );
}

