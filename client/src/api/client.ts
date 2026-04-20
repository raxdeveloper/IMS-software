import {
  cacheAppointmentsToday,
  cachePatientDetail,
  cachePatientsList,
  getCachedAppointmentsToday,
  getCachedPatientDetail,
  getPatientsListFromPath,
} from "../lib/offlineDb";
import { enqueueOfflineMutation, OfflineMutationQueuedError } from "../lib/offlineQueue";

export { OfflineMutationQueuedError, isOfflineMutationQueuedError } from "../lib/offlineQueue";

const TOKEN_KEY = "ims_token";

export function getStoredToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (typeof localStorage === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export type ApiError = { error: string | Record<string, unknown> };

function splitPath(path: string): { pathOnly: string; query: string } {
  const i = path.indexOf("?");
  if (i === -1) return { pathOnly: path, query: "" };
  return { pathOnly: path.slice(0, i), query: path.slice(i + 1) };
}

async function tryOfflineCache<T>(path: string, method: string): Promise<T | null> {
  if (method !== "GET") return null;
  try {
    if (path.includes("/api/appointments/queue/today")) {
      const d = await getCachedAppointmentsToday();
      if (d != null) {
        window.dispatchEvent(new CustomEvent("ims-offline-cache-hit", { detail: { path } }));
        return d as T;
      }
    }
    const { pathOnly } = splitPath(path);
    const m = /^\/api\/patients\/(\d+)$/.exec(pathOnly);
    if (m) {
      const d = await getCachedPatientDetail(Number(m[1]));
      if (d != null) {
        window.dispatchEvent(new CustomEvent("ims-offline-cache-hit", { detail: { path } }));
        return d as T;
      }
    }
    if (pathOnly === "/api/patients") {
      const d = await getPatientsListFromPath(path);
      if (d != null) {
        window.dispatchEvent(new CustomEvent("ims-offline-cache-hit", { detail: { path } }));
        return d as T;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function persistSuccessfulCache(path: string, method: string, data: unknown): Promise<void> {
  if (method !== "GET" || data == null) return;
  try {
    const { pathOnly, query } = splitPath(path);
    if (pathOnly === "/api/patients") {
      await cachePatientsList(query || "default", data);
    }
    const pm = /^\/api\/patients\/(\d+)$/.exec(pathOnly);
    if (pm) {
      await cachePatientDetail(Number(pm[1]), data);
    }
    if (path.includes("/api/appointments/queue/today")) {
      await cacheAppointmentsToday(data);
    }
  } catch {
    /* ignore */
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, body, ...rest } = options;
  const auth = token ?? getStoredToken();
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const method = (rest.method || "GET").toUpperCase();

  if (
    typeof navigator !== "undefined" &&
    !navigator.onLine &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(method)
  ) {
    if (isForm) {
      throw new Error("You are offline. Forms with files cannot be queued — connect to save.");
    }
    if (typeof body === "string") {
      await enqueueOfflineMutation({
        path,
        method,
        body,
        token: auth,
      });
      throw new OfflineMutationQueuedError();
    }
    throw new OfflineMutationQueuedError("You are offline — connect to retry.");
  }

  let res: Response;
  try {
    res = await fetch(path, {
      ...rest,
      body,
      headers: {
        ...(isForm ? {} : { "Content-Type": "application/json" }),
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
        ...headers,
      },
    });
  } catch {
    const fb = await tryOfflineCache<T>(path, method);
    if (fb != null) return fb;
    throw new Error("Network error — no connection.");
  }

  if (res.status === 204 || res.status === 205) {
    return undefined as T;
  }
  const text = await res.text();
  let data = {} as T & ApiError;
  if (text) {
    try {
      data = JSON.parse(text) as T & ApiError;
    } catch {
      data = { error: text.slice(0, 200) } as T & ApiError;
    }
  }

  if (!res.ok) {
    const errPayload = data as ApiError;
    if (res.status === 503 && method === "GET") {
      const eo = errPayload as { error?: string };
      if (eo?.error === "offline") {
        const fb = await tryOfflineCache<T>(path, method);
        if (fb != null) return fb;
      }
    }
    const err = new Error(
      typeof errPayload.error === "string" ? errPayload.error : `Request failed (${res.status})`,
    ) as Error & { status: number; body: unknown };
    err.status = res.status;
    err.body = data;
    if (method === "GET" && typeof navigator !== "undefined" && !navigator.onLine) {
      const fb = await tryOfflineCache<T>(path, method);
      if (fb != null) return fb;
    }
    throw err;
  }

  await persistSuccessfulCache(path, method, data);

  return data as T;
}
