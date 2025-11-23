"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
import { useResetPassword } from "@/hooks/useAccount";
import { ApiError } from "@/lib/api-client";
import { CheckCircle2, Circle } from "lucide-react";

const PASSWORD_COMPLEXITY =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

const REQUIREMENTS = [
  {
    label: "At least 8 characters",
    test: (value: string) => value.length >= 8,
  },
  {
    label: "One uppercase letter",
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    label: "One lowercase letter",
    test: (value: string) => /[a-z]/.test(value),
  },
  {
    label: "One number",
    test: (value: string) => /\d/.test(value),
  },
  {
    label: "One symbol",
    test: (value: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value),
  },
] as const;

export function PasswordResetForm({
  variant,
}: {
  variant: "reset" | "set";
}) {
  const heading = variant === "set" ? "Set your password" : "Reset your password";
  const description =
    variant === "set"
      ? "Create a password to access your dashboard for the first time."
      : "Enter a new password for your account.";

  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const resetPassword = useResetPassword();
  const [formState, setFormState] = useState({ newPassword: "", confirmPassword: "" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const checklist = REQUIREMENTS.map((requirement) => ({
    label: requirement.label,
    met: requirement.test(formState.newPassword),
  }));
  const passwordsMatch =
    formState.newPassword.length > 0 &&
    formState.newPassword === formState.confirmPassword;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token) {
      setError("Missing token. Please use the link from your email.");
      return;
    }
    if (formState.newPassword !== formState.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!PASSWORD_COMPLEXITY.test(formState.newPassword)) {
      setError(
        "Password must include uppercase, lowercase, number, and symbol (min 8 chars).",
      );
      return;
    }

    try {
      await resetPassword.mutateAsync({ token, newPassword: formState.newPassword });
      setSuccess("Password updated. Please log in again.");
      setFormState({ newPassword: "", confirmPassword: "" });
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      const rawMessage =
        err instanceof ApiError ? err.message : "Unable to update password right now.";
      const normalizedMessage =
        rawMessage.toLowerCase().includes("invalid or expired")
          ? "Reset link is invalid or expired. Please request a new one."
          : rawMessage;
      setError(normalizedMessage);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle>{heading}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {!token && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Missing token. Please use the link from your email.
              </p>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="new-password-field">
                New password
              </label>
              <Input
                id="new-password-field"
                type="password"
                autoComplete="new-password"
                placeholder="Strong password"
                value={formState.newPassword}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, newPassword: event.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="confirm-password-field"
              >
                Confirm password
              </label>
              <Input
                id="confirm-password-field"
                type="password"
                autoComplete="new-password"
                placeholder="Repeat new password"
                value={formState.confirmPassword}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, confirmPassword: event.target.value }))
                }
                required
              />
            </div>
            <div className="rounded-md bg-muted/50 p-3">
              <p className="mb-2 text-sm font-semibold text-foreground">Password requirements</p>
              <ul className="space-y-1 text-sm">
                {checklist.map((item) => (
                  <li key={item.label} className="flex items-center gap-2">
                    {item.met ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={item.met ? "text-foreground" : "text-muted-foreground"}>
                      {item.label}
                    </span>
                  </li>
                ))}
                <li className="flex items-center gap-2">
                  {passwordsMatch ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={passwordsMatch ? "text-foreground" : "text-muted-foreground"}>
                    Passwords match
                  </span>
                </li>
              </ul>
            </div>
            {success && (
              <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {success}
              </p>
            )}
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={resetPassword.isPending || !token}>
              {resetPassword.isPending ? "Saving…" : "Save password"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
