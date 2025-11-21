"use client";

import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { cn } from "@/lib/utils";
import { useAdminTickets } from "@/hooks/useTickets";
import {
  formatTicketDate,
  TICKET_STATUS_BADGES,
  TICKET_STATUS_LABELS,
  TICKET_TYPE_LABELS,
} from "@/lib/ticket-display";

export default function AdminTicketsPage() {
  const router = useRouter();
  const { data, isLoading, isError } = useAdminTickets({ page: 1, pageSize: 20 });
  const tickets = data?.items ?? [];

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="space-y-6">
        <header className="space-y-1">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Admin</p>
          <h1 className="text-3xl font-semibold text-foreground">Support Tickets</h1>
          <p className="text-sm text-muted-foreground">
            View and respond to maintenance and content requests across all tenants.
          </p>
        </header>

        <section className="rounded-lg border border-border">
          {isLoading && (
            <p className="px-6 py-6 text-sm text-muted-foreground">Loading tickets…</p>
          )}
          {isError && (
            <p className="px-6 py-6 text-sm text-destructive">
              We couldn’t load tickets. Please refresh and try again.
            </p>
          )}
          {!isLoading && !isError && tickets.length === 0 && (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              <p>No tickets yet. Clients’ requests will appear here as soon as they’re submitted.</p>
            </div>
          )}
          {!isLoading && !isError && tickets.length > 0 && (
            <div className="divide-y divide-border">
              <div className="hidden grid-cols-5 gap-4 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
                <span>Tenant</span>
                <span>Title</span>
                <span>Type</span>
                <span>Status</span>
                <span>Updated</span>
              </div>
              <div className="lg:hidden px-6 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tickets
              </div>
              {tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => router.push(`/admin/tickets/${ticket.id}`)}
                  className="w-full px-6 py-4 text-left transition hover:bg-muted/50"
                >
                  <div className="grid gap-3 lg:grid-cols-5 lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {ticket.tenantName ?? ticket.tenantId}
                        </p>
                        {ticket.hasUnreadForAdmin && (
                          <span className="flex items-center gap-1 text-xs font-semibold text-destructive">
                            <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        #{ticket.id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                    <p className="text-sm text-foreground">{ticket.title}</p>
                    <p className="text-sm text-muted-foreground">{TICKET_TYPE_LABELS[ticket.type]}</p>
                    <span
                      className={cn(
                        "w-fit rounded-full px-2.5 py-1 text-xs font-semibold",
                        TICKET_STATUS_BADGES[ticket.status],
                      )}
                    >
                      {TICKET_STATUS_LABELS[ticket.status]}
                    </span>
                    <p className="text-sm text-muted-foreground">
                      {formatTicketDate(ticket.lastMessageAt, true)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </ProtectedRoute>
  );
}

