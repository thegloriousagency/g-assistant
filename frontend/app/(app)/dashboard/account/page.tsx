import { ProtectedRoute } from "@/components/auth/protected-route";
import { AccountSettings } from "@/components/account/account-settings";

export default function DashboardAccountPage() {
  return (
    <ProtectedRoute>
      <AccountSettings heading="Account settings" />
    </ProtectedRoute>
  );
}
