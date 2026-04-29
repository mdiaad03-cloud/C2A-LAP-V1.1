import { useEffect, useMemo, useState } from "react";
import api, { setSessionHeaders } from "../lib/api";

import { AuthContext } from "./AuthContextObject";
const STORAGE_KEY = "c2a_lap_session_v1";
const EMPTY_SESSION = { token: "", csrfToken: "", user: null };

function normalizeSession(rawSession) {
  if (!rawSession || typeof rawSession !== "object") {
    return EMPTY_SESSION;
  }
  return {
    token: typeof rawSession.token === "string" ? rawSession.token : "",
    csrfToken: typeof rawSession.csrfToken === "string" ? rawSession.csrfToken : "",
    user: rawSession.user && typeof rawSession.user === "object" ? rawSession.user : null,
  };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return EMPTY_SESSION;
      }
      return normalizeSession(JSON.parse(raw));
    } catch {
      return EMPTY_SESSION;
    }
  });

  useEffect(() => {
    setSessionHeaders(session.token, session.csrfToken);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Ignore storage write issues (private mode / quota / denied storage).
    }
  }, [session]);

  async function login(username, password) {
    const response = await api.post("/auth/login", { username, password });
    const nextSession = {
      token: response.data.token,
      csrfToken: response.data.csrfToken,
      user: response.data.user,
    };
    setSessionHeaders(nextSession.token, nextSession.csrfToken);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    } catch {
      // Ignore storage write issues.
    }
    setSession(nextSession);
    return nextSession.user;
  }

  function logout() {
    setSession(EMPTY_SESSION);
  }

  const value = useMemo(
    () => ({
      user: session.user,
      token: session.token,
      csrfToken: session.csrfToken,
      isAuthenticated: Boolean(session.token && session.user),
      login,
      logout,
      setUser: (user) => setSession((prev) => ({ ...prev, user })),
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
