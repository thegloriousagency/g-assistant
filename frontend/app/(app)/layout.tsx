"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAdminTickets, useClientTickets } from "@/hooks/useTickets";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, tenant, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = user?.role === "admin";
  const isClient = user?.role === "client";
  const { data: adminTicketData } = useAdminTickets(
    { page: 1, pageSize: 20 },
    { enabled: isAdmin },
  );
  const hasUnreadAdminTickets = Boolean(
    adminTicketData?.items?.some((ticket) => ticket.hasUnreadForAdmin),
  );
  const { data: clientTicketData } = useClientTickets(
    { page: 1, pageSize: 20 },
    { enabled: Boolean(isClient && tenant) },
  );
  const hasUnreadClientTickets = Boolean(
    clientTicketData?.items?.some((ticket) => ticket.hasUnreadForClient),
  );

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const navLinkClass = (href: string) => {
    const isActive = pathname === href;
    return [
      "block rounded px-2 py-1 text-sm transition-colors",
      isActive ? "font-medium text-primary bg-muted/60" : "text-muted-foreground hover:text-primary",
    ].join(" ");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-6 py-4">
          <div className="flex flex-col">
            <span className="text-lg font-semibold">Glorious Dashboard</span>
            <span className="text-sm text-muted-foreground">
              Multi-tenant SaaS workspace
            </span>
          </div>
          {user && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">{user.email}</span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          )}
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-screen-2xl flex-1">
        <aside className="hidden w-64 border-r border-border bg-muted/30 p-6 lg:block">
          <nav className="space-y-2">
            <Link className={navLinkClass("/dashboard")} href="/dashboard">
              Dashboard
            </Link>
            <Link className={navLinkClass("/dashboard/hosting")} href="/dashboard/hosting">
              Hosting
            </Link>
            <Link className={navLinkClass("/dashboard/maintenance")} href="/dashboard/maintenance">
              Maintenance
            </Link>
            <Link
              className={cn(
                navLinkClass("/dashboard/maintenance/tickets"),
                "flex items-center justify-between gap-2",
              )}
              href="/dashboard/maintenance/tickets"
            >
              <span>Support tickets</span>
              {hasUnreadClientTickets && (
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
              )}
            </Link>
            {isAdmin && (
              <>
                <Link className={navLinkClass("/admin/tenants")} href="/admin/tenants">
                  Tenants
                </Link>
                <Link
                  className={cn(
                    navLinkClass("/admin/tickets"),
                    "flex items-center justify-between gap-2",
                  )}
                  href="/admin/tickets"
                >
                  <span>Admin tickets</span>
                  {hasUnreadAdminTickets && (
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
                  )}
                </Link>
              </>
            )}
          </nav>
        </aside>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
