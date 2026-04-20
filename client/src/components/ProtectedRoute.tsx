import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type UserRole } from "../auth/AuthContext";

type Props = {
  children: ReactNode;
  roles?: UserRole[];
};

export function ProtectedRoute({ children, roles }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-full max-w-md space-y-3 p-6">
          <div className="h-10 rounded-lg bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
          <div className="h-32 rounded-lg bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
          <div className="h-8 rounded-lg bg-zinc-200 dark:bg-zinc-800 animate-pulse w-2/3 mx-auto" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles?.length && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
