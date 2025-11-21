"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useAddAdminTicketMessage,
  useAdminTicket,
  useUpdateAdminTicketStatus,
} from "@/hooks/useTickets";
import {
  formatTicketDate,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_OPTIONS,
  TICKET_TYPE_LABELS,
} from "@/lib/ticket-display";
import type { TicketStatus } from "@/types/tickets";

export default function AdminTicketDetailPage() {
  const params = useParams<{ ticketId: string }>();
  const ticketId = params?.ticketId;
  const router = useRouter();
  const { data: ticket, isLoading, isError } = useAdminTicket(ticketId);
  const updateStatus = useUpdateAdminTicketStatus(ticketId);
  const addMessage = useAddAdminTicketMessage(ticketId);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const messages = useMemo(() => {
    if (!ticket?.messages) return [];
    return [...ticket.messages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [ticket?.messages]);

  const handleStatusChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (!ticketId) return;
    const status = event.target.value as TicketStatus;
    updateStatus.mutate({ status });
  };

  const handleReply = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!body.trim()) {
      setError("Please enter a message before sending.");
      return;
    }
    try {
      await addMessage.mutateAsync({ body: body.trim() });
      setBody("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send reply. Please try again.",
      );
    }
  };

  if (!ticketId) {
    return (
      <ProtectedRoute requiredRole="admin">
        <div className="space-y-4">
          <Button variant="ghost" className="px-0 text-muted-foreground" onClick={() => router.back()}>
            ← Back to tickets
          </Button>
          <p className="text-sm text-muted-foreground">Ticket not found.</p>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="space-y-6">
        <Button variant="ghost" className="px-0 text-muted-foreground" onClick={() => router.back()}>
          ← Back to tickets
        </Button>

        {isLoading && <p className="text-sm text-muted-foreground">Loading ticket…</p>}
        {isError && (
          <p className="text-sm text-destructive">
            There was a problem loading this ticket. Please refresh and try again.
          </p>
        )}

        {!isLoading && !isError && ticket && (
          <>
            <header className="space-y-4 rounded-lg border border-border p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {ticket.tenantName ?? ticket.tenantId}
                  </p>
                  <h1 className="text-2xl font-semibold text-foreground">{ticket.title}</h1>
                  <p className="text-sm text-muted-foreground">{TICKET_TYPE_LABELS[ticket.type]}</p>
                </div>
                <div className="space-y-2 text-sm">
                  <label className="text-muted-foreground">Status</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={ticket.status}
                    onChange={handleStatusChange}
                    disabled={updateStatus.isPending}
                  >
                    {TICKET_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {TICKET_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {(ticket.status === "RESOLVED" || ticket.status === "CLOSED") && (
                <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  This ticket is resolved. You can still send updates or change the status if needed.
                </div>
              )}
            </header>

            <section className="space-y-4 rounded-lg border border-border p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Conversation
              </h2>
              <div className="space-y-4">
                {messages.length === 0 && (
                  <p className="text-sm text-muted-foreground">No messages yet.</p>
                )}
                {messages.map((message, index) => {
                  const isClient = message.authorRole === "CLIENT";
                  const label = isClient
                    ? ticket.tenantName ?? "Client"
                    : "You (Support Team)";
                  const bubbleClass = isClient
                    ? "bg-muted text-foreground"
                    : "bg-primary text-primary-foreground";
                  const containerClass = isClient ? "items-start text-left" : "items-end text-right";
                  const previous = messages[index - 1];
                  const showLabel = previous?.authorRole !== message.authorRole;
                  return (
                    <div key={message.id} className={cn("flex flex-col gap-1", containerClass)}>
                      {showLabel && (
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {label}
                        </p>
                      )}
                      <div
                        className={cn(
                          "max-w-full whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm sm:max-w-[80%]",
                          bubbleClass,
                        )}
                      >
                        {message.body}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatTicketDate(message.createdAt, true)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg border border-border p-4">
              <form className="space-y-3" onSubmit={handleReply}>
                <label className="text-sm font-medium text-foreground" htmlFor="admin-reply">
                  Reply to client
                </label>
                <textarea
                  id="admin-reply"
                  className="flex min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Share updates, answers, or next steps."
                  disabled={addMessage.isPending}
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setBody("")}
                    disabled={addMessage.isPending}
                  >
                    Clear
                  </Button>
                  <Button type="submit" disabled={addMessage.isPending}>
                    {addMessage.isPending ? "Sending…" : "Send reply"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sending a reply automatically marks the ticket as “In progress” if it was open.
                </p>
              </form>
            </section>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}

