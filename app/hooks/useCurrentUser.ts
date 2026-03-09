"use client";

import { useState, useEffect, useCallback } from "react";

export type CurrentUser = {
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  role: string;
  clinic_id: string | null;
};

let cached: CurrentUser | null = null;

export function useCurrentUser(): {
  user: CurrentUser | null;
  loading: boolean;
  error: boolean;
  refetch: () => void;
} {
  const [user, setUser] = useState<CurrentUser | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(false);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(false);
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Not authenticated");
        return res.json();
      })
      .then((data) => {
        const u: CurrentUser = {
          user_id: data.user_id ?? data.user?.id ?? "",
          user_name: data.user_name ?? data.user?.user_metadata?.full_name ?? null,
          user_email: data.user_email ?? data.user?.email ?? null,
          role: data.role ?? "secretary",
          clinic_id: data.clinic_id ?? null,
        };
        cached = u;
        setUser(u);
      })
      .catch(() => {
        setError(true);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (cached) {
      setUser(cached);
      setLoading(false);
      return;
    }
    refetch();
  }, [refetch]);

  return { user, loading, error, refetch };
}
