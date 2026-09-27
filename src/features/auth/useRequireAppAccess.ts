// Guards an app page: sends visitors to /login and not-yet-invited accounts to /activate.
// Returns the user only once they are allowed in.
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, type User } from "@/store/auth";

export const hasAppAccess = (user: User | null) =>
  Boolean(user && (user.role === "superadmin" || user.accessGranted));

export function useRequireAppAccess(): User | null {
  const user = useAuth((state) => state.user);
  const initialized = useAuth((state) => state.initialized);
  const init = useAuth((state) => state.init);
  const navigate = useNavigate();

  useEffect(() => {
    void init();
  }, [init]);

  const allowed = hasAppAccess(user);
  useEffect(() => {
    if (!initialized) return;
    if (!user) navigate({ to: "/login" });
    else if (!allowed) navigate({ to: "/activate" });
  }, [initialized, user, allowed, navigate]);

  return initialized && allowed ? user : null;
}
