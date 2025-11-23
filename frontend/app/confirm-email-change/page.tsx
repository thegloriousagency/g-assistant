"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useConfirmEmailChange } from "@/hooks/useAccount";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

export default function ConfirmEmailChangePage() {
  return (
    <ProtectedRoute>
      <ConfirmEmailChangeContent />
    </ProtectedRoute>
  );
}

function ConfirmEmailChangeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const confirmMutation = useConfirmEmailChange();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("Verifying email change…");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing token. Please use the link from your email.");
      return;
    }
    let isMounted = true;
    confirmMutation
      .mutateAsync(token)
      .then(() => {
        if (isMounted) {
          setStatus("success");
          setMessage("Email updated successfully.");
        }
      })
      .catch((error) => {
        if (!isMounted) return;
        const errMessage =
          error instanceof ApiError
            ? error.message
            : "We couldn’t verify that token. Try requesting a new link.";
        setStatus("error");
        setMessage(errMessage);
      });
    return () => {
      isMounted = false;
    };
  }, [confirmMutation, token]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold text-foreground">Confirm email change</h1>
      <p className={`text-sm ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
        {message}
      </p>
      <Button asChild variant="outline">
        <a href="/dashboard/account">Back to account settings</a>
      </Button>
    </div>
  );
}
