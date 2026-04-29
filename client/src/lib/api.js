import axios from "axios";

const STORAGE_KEY = "c2a_lap_session_v1";

const api = axios.create({
  baseURL: "/api",
  timeout: 15000,
});

export function setSessionHeaders(token, csrfToken) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }

  if (csrfToken) {
    api.defaults.headers.common["X-CSRF-Token"] = csrfToken;
  } else {
    delete api.defaults.headers.common["X-CSRF-Token"];
  }
}

api.interceptors.request.use((config) => {
  const headers = config.headers || {};
  const hasAuthHeader = Boolean(headers.Authorization);
  const hasCsrfHeader = Boolean(headers["X-CSRF-Token"]);

  if (!hasAuthHeader || !hasCsrfHeader) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const session = JSON.parse(raw);
        if (!hasAuthHeader && session?.token) {
          headers.Authorization = `Bearer ${session.token}`;
        }
        if (!hasCsrfHeader && session?.csrfToken) {
          headers["X-CSRF-Token"] = session.csrfToken;
        }
      }
    } catch {
      // Ignore malformed local storage content.
    }
  }

  config.headers = headers;
  return config;
});

export default api;
