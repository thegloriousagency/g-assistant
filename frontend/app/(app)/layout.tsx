"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAdminTickets, useClientTickets } from "@/hooks/useTickets";
import {
  LayoutDashboard,
  Server,
  Wrench,
  BarChart3,
  UserCircle,
  LifeBuoy,
  Users,
  Ticket,
  LogOut,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    return cn(
      "flex items-center justify-between gap-2 rounded px-2 py-1 text-sm transition-colors",
      isActive ? "font-medium text-primary bg-muted/60" : "text-muted-foreground hover:text-primary",
    );
  };

  const NavLink = ({
    href,
    label,
    icon: Icon,
    badge,
  }: {
    href: string;
    label: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    badge?: React.ReactNode;
  }) => (
    <Link className={navLinkClass(href)} href={href}>
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span>{label}</span>
      </span>
      {badge}
    </Link>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col pb-20">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo.svg"
              alt="The Glorious Agency"
              width={140}
              height={28}
              priority
            />
            <span className="sr-only">The Glorious Agency Dashboard</span>
          </Link>
          {user && (
            <div className="flex items-center gap-4 text-sm">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <span className="hidden lg:inline">Hi, {user.email}</span>
                    <span className="lg:hidden">Menu</span>
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Signed in as
                  </DropdownMenuLabel>
                  <div className="truncate px-2 text-sm font-medium text-foreground">
                    {user.email}
                  </div>
                  <DropdownMenuSeparator />
                  <div className="lg:hidden">
                    <nav className="space-y-1">
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard" className="flex items-center gap-2">
                          <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                          Dashboard
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard/analytics" className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" aria-hidden="true" />
                          Analytics
                        </Link>
                      </DropdownMenuItem>
                      {!isAdmin && (
                        <>
                          <DropdownMenuItem asChild>
                            <Link href="/dashboard/hosting" className="flex items-center gap-2">
                              <Server className="h-4 w-4" aria-hidden="true" />
                              Hosting
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href="/dashboard/maintenance" className="flex items-center gap-2">
                              <Wrench className="h-4 w-4" aria-hidden="true" />
                              Maintenance
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link
                              href="/dashboard/maintenance/tickets"
                              className="flex items-center gap-2"
                            >
                              <LifeBuoy className="h-4 w-4" aria-hidden="true" />
                              Support tickets
                            </Link>
                          </DropdownMenuItem>
                        </>
                      )}
                      {isAdmin && (
                        <>
                          <DropdownMenuItem asChild>
                            <Link href="/admin/tickets" className="flex items-center gap-2">
                              <Ticket className="h-4 w-4" aria-hidden="true" />
                              Admin tickets
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href="/admin/tenants" className="flex items-center gap-2">
                              <Users className="h-4 w-4" aria-hidden="true" />
                              Tenants
                            </Link>
                          </DropdownMenuItem>
                        </>
                      )}
                    </nav>
                    <DropdownMenuSeparator />
                  </div>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/account" className="flex items-center gap-2">
                      <UserCircle className="h-4 w-4" aria-hidden="true" />
                      Account settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={(event) => {
                      event.preventDefault();
                      handleLogout();
                    }}
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-screen-2xl flex-1">
        <aside className="hidden w-64 border-r border-border bg-muted/30 p-6 lg:block">
          <nav className="space-y-2">
            <NavLink href="/dashboard" label="Dashboard" icon={LayoutDashboard} />
            <NavLink href="/dashboard/analytics" label="Analytics" icon={BarChart3} />
            {!isAdmin && (
              <>
                <NavLink href="/dashboard/hosting" label="Hosting" icon={Server} />
                <NavLink href="/dashboard/maintenance" label="Maintenance" icon={Wrench} />
              </>
            )}
            {isAdmin && (
              <>
                <NavLink
                  href="/admin/tickets"
                  label="Admin tickets"
                  icon={Ticket}
                  badge={
                    hasUnreadAdminTickets ? (
                      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
                    ) : undefined
                  }
                />
                <NavLink href="/admin/tenants" label="Tenants" icon={Users} />
              </>
            )}
            {!isAdmin && (
              <NavLink
                href="/dashboard/maintenance/tickets"
                label="Support tickets"
                icon={LifeBuoy}
                badge={
                  hasUnreadClientTickets ? (
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
                  ) : undefined
                }
              />
            )}
          </nav>
        </aside>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
