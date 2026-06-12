import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  AuthUser,
  LoginPayload,
  RegisterPayload,
  canManageFinance as canManageFinanceRole,
  clearStoredAuthToken,
  fetchCurrentUser,
  getStoredAuthToken,
  isAdmin as isAdminRole,
  loginUser,
  logoutUser,
  registerUser,
  storeAuthTokens,
} from "./api";
import { useToast } from "./toast-context";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isApproved: boolean;
  isAdmin: boolean;
  canManageFinance: boolean;
  login: (payload: LoginPayload) => Promise<AuthUser>;
  register: (payload: RegisterPayload) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { notify } = useToast();

  const refreshUser = useCallback(async () => {
    const token = getStoredAuthToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      setUser(await fetchCurrentUser());
    } catch {
      clearStoredAuthToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (payload: LoginPayload) => {
    const session = await loginUser(payload);
    storeAuthTokens(session.access_token, session.refresh_token);
    setUser(session.user);
    notify("Signed in.", "success");
    return session.user;
  }, [notify]);

  const register = useCallback(async (payload: RegisterPayload) => {
    const session = await registerUser(payload);
    storeAuthTokens(session.access_token, session.refresh_token);
    setUser(session.user);
    notify(session.user.status === "approved" ? "Account created." : "Access request submitted.", "success");
    return session.user;
  }, [notify]);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } catch {
      // Local logout should still clear the browser session if the backend is unavailable.
    } finally {
      clearStoredAuthToken();
      setUser(null);
      notify("Signed out.", "info");
    }
  }, [notify]);

  useEffect(() => {
    const handleExpired = () => {
      clearStoredAuthToken();
      setUser(null);
      notify("Session expired. Please sign in again.", "error");
    };
    window.addEventListener("zapp-auth-expired", handleExpired);
    return () => window.removeEventListener("zapp-auth-expired", handleExpired);
  }, [notify]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isApproved: user?.status === "approved",
      isAdmin: isAdminRole(user),
      canManageFinance: canManageFinanceRole(user),
      login,
      register,
      logout,
      refreshUser,
    }),
    [loading, login, logout, refreshUser, register, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
