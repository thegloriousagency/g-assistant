 "use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { apiFetch, ApiError } from "@/lib/api-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface Tenant {
  id: string;
  name: string;
  websiteUrl?: string | null;
  contactEmail?: string | null;
  wpSiteUrl?: string | null;
  wpApiUser?: string | null;
  wpAppPassword?: string | null;
}

const createTenantSchema = z.object({
  name: z.string().min(2, "Name is required"),
  websiteUrl: z
    .string()
    .url("Must be a valid URL")
    .or(z.literal(""))
    .optional(),
  contactEmail: z
    .string()
    .email("Invalid email")
    .or(z.literal(""))
    .optional(),
  wpSiteUrl: z
    .string()
    .url("Must be a valid URL")
    .or(z.literal(""))
    .optional(),
  wpApiUser: z.string().or(z.literal("")).optional(),
  wpAppPassword: z.string().or(z.literal("")).optional(),
});

type CreateTenantInput = z.infer<typeof createTenantSchema>;

export default function AdminTenantsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<CreateTenantInput>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      name: "",
      websiteUrl: "",
      contactEmail: "",
      wpSiteUrl: "",
      wpApiUser: "",
      wpAppPassword: "",
    },
  });

  const { data, isLoading, isError } = useQuery<Tenant[]>({
    queryKey: ["admin", "tenants"],
    queryFn: () => apiFetch<Tenant[]>("/admin/tenants", { method: "GET" }, true),
  });

  const createMutation = useMutation({
    mutationFn: async (values: CreateTenantInput) => {
      const payload = {
        name: values.name,
        websiteUrl: values.websiteUrl?.trim() ? values.websiteUrl.trim() : undefined,
        contactEmail: values.contactEmail?.trim() ? values.contactEmail.trim() : undefined,
        wpSiteUrl: values.wpSiteUrl?.trim() ? values.wpSiteUrl.trim() : undefined,
        wpApiUser: values.wpApiUser?.trim() ? values.wpApiUser.trim() : undefined,
        wpAppPassword: values.wpAppPassword?.trim()
          ? values.wpAppPassword.trim()
          : undefined,
      };
      return apiFetch<Tenant>(
        "/admin/tenants",
        { method: "POST", body: JSON.stringify(payload) },
        true,
      );
    },
    onSuccess: () => {
      form.reset();
      setSubmitError(null);
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "Failed to create tenant";
      setSubmitError(message);
    },
  });

  const filteredTenants = useMemo(() => {
    if (!data) return [];
    const filtered = data.filter((tenant) =>
      tenant.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    return filtered.sort((a, b) =>
      sortOrder === "asc"
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name),
    );
  }, [data, searchTerm, sortOrder]);

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">
              Admin
            </p>
            <h1 className="text-3xl font-semibold">Tenants</h1>
            <p className="text-muted-foreground">
              Manage all client workspaces in one place.
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>Add Tenant</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Tenant</DialogTitle>
                <DialogDescription>
                  Provide the basic details for a new tenant account.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Acme Inc." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
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
                    control={form.control}
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
                  <FormField
                    control={form.control}
                    name="wpSiteUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WordPress Site URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://wp.example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="wpApiUser"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WordPress API User</FormLabel>
                        <FormControl>
                          <Input placeholder="wp-api-user" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="wpAppPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WordPress Application Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Application password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {submitError && (
                    <p className="text-sm text-destructive">{submitError}</p>
                  )}
                  <DialogFooter>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Creating..." : "Create tenant"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-4 py-6 md:flex-row md:items-center">
            <Input
              placeholder="Search tenants..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="md:w-1/3"
            />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Sort:</span>
              <select
                value={sortOrder}
                onChange={(event) =>
                  setSortOrder(event.target.value === "desc" ? "desc" : "asc")
                }
                className="rounded-md border border-border bg-background px-2 py-1 text-sm"
              >
                <option value="asc">Name A → Z</option>
                <option value="desc">Name Z → A</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tenant directory</CardTitle>
            <CardDescription>Navigate to a tenant to manage details and users.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && (
              <p className="text-sm text-muted-foreground">Loading tenants...</p>
            )}
            {isError && (
              <p className="text-sm text-destructive">
                Failed to load tenants. Please retry.
              </p>
            )}
            {!isLoading &&
              !isError &&
              filteredTenants.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No tenants match your search.
                </p>
              )}
            {!isLoading &&
              !isError &&
              filteredTenants.map((tenant) => {
                const wpConfigured =
                  Boolean(tenant.wpSiteUrl) &&
                  Boolean(tenant.wpApiUser) &&
                  Boolean(tenant.wpAppPassword);
                return (
                  <Card key={tenant.id} className="border border-border">
                    <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle>{tenant.name}</CardTitle>
                        <CardDescription>
                          {tenant.websiteUrl ?? "No website on file"}
                        </CardDescription>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/tenants/${tenant.id}`}>Open</Link>
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm text-muted-foreground">
                      <p>Contact: {tenant.contactEmail ?? "Not provided"}</p>
                      <p
                        className={
                          wpConfigured ? "text-emerald-600" : "text-muted-foreground"
                        }
                      >
                        {wpConfigured ? "WP configured" : "WP not configured"}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
