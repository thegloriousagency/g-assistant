"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api-client";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "admin@local.test",
      password: "Admin123!",
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    console.debug("[login] submitting", values.email);
    try {
      setFormError(null);
      const me = await login(values.email, values.password);
      const role = me?.user.role;
      if (role === "admin") {
        router.push("/admin/tenants");
        return;
      }
      router.push("/dashboard");
    } catch (error) {
      console.error("[login] failed", error);
      const message =
        error instanceof ApiError ? error.message : "Unable to sign in";
      setFormError(message);
      form.setError("password", { message: "Check your credentials" });
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Access your tenant workspace. Admins will see elevated controls later.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-6">
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@company.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="********" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "Signing in..." : "Continue"}
              </Button>
              {formError && (
                <p className="text-center text-sm text-destructive">{formError}</p>
              )}
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
