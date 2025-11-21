"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAddClientTicketMessage, useClientTicket } from "@/hooks/useTickets";
import type { TicketStatus, TicketType } from "@/types/tickets";

const typeLabelMap: Record<TicketType, string> = {
  MAINTENANCE: "Maintenance issue",
  CONTENT_UPDATE: "Content update / text or image change",
  BUG: "Bug / technical issue",
  BILLING: "Billing / account question",
  OTHER: "Other",
};

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

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function TicketDetailPage() {
  const params = useParams<{ ticketId: string }>();
  const ticketId = params?.ticketId;
  const router = useRouter();
  const { data: ticket, isLoading, isError } = useClientTicket(ticketId);
  const addMessage = useAddClientTicketMessage(ticketId);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const messages = useMemo(() => {
    if (!ticket?.messages) return [];
    return [...ticket.messages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [ticket?.messages]);

  if (!ticketId) {
    return (
      <ProtectedRoute>
        <div className="space-y-4">
          <Button variant="ghost" className="px-0 text-muted-foreground" onClick={() => router.back()}>
            ← Back to requests
          </Button>
          <p className="text-sm text-muted-foreground">Ticket not found.</p>
        </div>
      </ProtectedRoute>
    );
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
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
        err instanceof Error ? err.message : "We couldn’t send your message. Please try again.",
      );
    }
  };

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <Button variant="ghost" className="px-0 text-muted-foreground" onClick={() => router.back()}>
          ← Back to requests
        </Button>

        {isLoading && <p className="text-sm text-muted-foreground">Loading conversation…</p>}
        {isError && (
          <p className="text-sm text-destructive">
            We couldn’t load this conversation. Please refresh the page.
          </p>
        )}

        {!isLoading && !isError && ticket && (
          <>
            <header className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{typeLabelMap[ticket.type]}</p>
                  <h1 className="text-2xl font-semibold text-foreground">{ticket.title}</h1>
                </div>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-sm font-semibold",
                    statusBadgeClass[ticket.status],
                  )}
                >
                  {statusLabelMap[ticket.status]}
                </span>
              </div>
              {(ticket.status === "RESOLVED" || ticket.status === "CLOSED") && (
                <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  This request has been resolved. If you need additional help, please open a new
                  request.
                </div>
              )}
            </header>

            <section className="space-y-4 rounded-lg border border-border p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Conversation
              </h2>
              <div className="space-y-4">
                {messages.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No messages yet. Start the conversation below.
                  </p>
                )}
                {messages.map((message, index) => {
                  const isClient = message.authorRole === "CLIENT";
                  const bubbleClass = isClient
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground";
                  const containerClass = isClient ? "items-end text-right" : "items-start text-left";
                  const label = isClient ? "You" : "The Glorious Agency Support Team";
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
                        {formatDateTime(message.createdAt)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg border border-border p-4">
              {ticket.status === "CLOSED" ? (
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>This request is closed and can no longer be updated.</p>
                  <p>
                    If something new comes up, please open a new request using the button on the
                    tickets page.
                  </p>
                </div>
              ) : (
                <form className="space-y-3" onSubmit={handleSubmit}>
                  <label className="text-sm font-medium text-foreground" htmlFor="reply-body">
                    Reply
                  </label>
                  <textarea
                    id="reply-body"
                    className="flex min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    placeholder="Write your message here…"
                    disabled={addMessage.isPending}
                  />
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <div className="flex justify-end">
                    <Button type="submit" disabled={addMessage.isPending}>
                      {addMessage.isPending ? "Sending…" : "Send message"}
                    </Button>
                  </div>
                </form>
              )}
            </section>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}

