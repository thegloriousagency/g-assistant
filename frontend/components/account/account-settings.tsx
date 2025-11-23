"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import { useChangeEmail, useChangePassword } from "@/hooks/useAccount";

const PASSWORD_COMPLEXITY =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

function PasswordHint() {
  return (
    <p className="text-xs text-muted-foreground">
      Must be at least 8 characters and include uppercase, lowercase, number, and symbol.
    </p>
  );
}

export function AccountSettings({ heading }: { heading: string }) {
  const changeEmail = useChangeEmail();
  const changePassword = useChangePassword();

  const [emailForm, setEmailForm] = useState({ newEmail: "", password: "" });
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailMessage(null);
    setEmailError(null);
    try {
      await changeEmail.mutateAsync({
        newEmail: emailForm.newEmail,
        password: emailForm.password,
      });
      setEmailMessage("Check your new inbox to confirm the email change.");
      setEmailForm({ newEmail: "", password: "" });
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Unable to change email right now.";
      setEmailError(message);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (!PASSWORD_COMPLEXITY.test(passwordForm.newPassword)) {
      setPasswordError(
        "Password must include uppercase, lowercase, number, and symbol (min 8 chars).",
      );
      return;
    }

    try {
      await changePassword.mutateAsync({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordMessage("Password updated. This will sign you out on other devices.");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Unable to change password right now.";
      setPasswordError(message);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{heading}</h1>
        <p className="text-sm text-muted-foreground">
          Manage how you sign in to The Glorious Agency dashboard.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Change email address</CardTitle>
            <CardDescription>
              Update your login email. We will send a confirmation link to the new inbox.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleEmailSubmit}>
              <div className="space-y-2">
                <Label htmlFor="new-email">New email</Label>
                <Input
                  id="new-email"
                  type="email"
                  placeholder="you@company.com"
                  value={emailForm.newEmail}
                  onChange={(event) =>
                    setEmailForm((prev) => ({ ...prev, newEmail: event.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-password">Current password</Label>
                <Input
                  id="email-password"
                  type="password"
                  placeholder="••••••••"
                  value={emailForm.password}
                  onChange={(event) =>
                    setEmailForm((prev) => ({ ...prev, password: event.target.value }))
                  }
                  required
                />
              </div>
              <Button type="submit" disabled={changeEmail.isPending}>
                {changeEmail.isPending ? "Sending confirmation…" : "Send confirmation email"}
              </Button>
              {emailMessage && (
                <p className="text-sm text-emerald-600">{emailMessage}</p>
              )}
              {emailError && <p className="text-sm text-destructive">{emailError}</p>}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>
              Use a strong password to keep your account secure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handlePasswordSubmit}>
              <div className="space-y-2">
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  type="password"
                  placeholder="••••••••"
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      currentPassword: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Strong password"
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      newPassword: event.target.value,
                    }))
                  }
                  required
                />
                <PasswordHint />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Repeat new password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      confirmPassword: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <Button type="submit" disabled={changePassword.isPending}>
                {changePassword.isPending ? "Updating…" : "Update password"}
              </Button>
              {passwordMessage && (
                <p className="text-sm text-emerald-600">{passwordMessage}</p>
              )}
              {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
