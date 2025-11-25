"use client";

import Link from "next/link";
import { useState } from "react";
import { useForgotPassword } from "@/hooks/useAccount";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const forgotPassword = useForgotPassword();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "success">("idle");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) return;

    try {
      await forgotPassword.mutateAsync(normalizedEmail);
    } catch (error) {
      console.warn("[forgot-password] request failed", error);
    } finally {
      setStatus("success");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle>Forgot password?</CardTitle>
          <CardDescription>
            Enter the email linked to your Glorious account and we&apos;ll send reset
            instructions.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="forgot-email">
                Email address
              </label>
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={forgotPassword.isPending}
              />
            </div>
            {status === "success" && (
              <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                If an account exists for that email, we sent a reset link. Please check your
                inbox and spam folder.
              </p>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              type="submit"
              className="w-full"
              disabled={forgotPassword.isPending || email.trim().length === 0}
            >
              {forgotPassword.isPending ? "Sending…" : "Send reset link"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
                Return to sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}



