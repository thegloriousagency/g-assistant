import { ProtectedRoute } from "@/components/auth/protected-route";
import { AccountSettings } from "@/components/account/account-settings";

export default function AdminAccountPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <AccountSettings heading="Admin account settings" />
    </ProtectedRoute>
  );
}
