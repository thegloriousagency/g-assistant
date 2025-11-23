import { Suspense } from "react";
import { PasswordResetForm } from "@/components/auth/password-reset-form";

function ResetPasswordFormFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 text-center text-sm text-muted-foreground shadow-sm">
        Loading reset form…
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFormFallback />}>
      <PasswordResetForm variant="reset" />
    </Suspense>
  );
}

