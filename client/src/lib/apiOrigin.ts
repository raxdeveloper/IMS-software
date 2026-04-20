/**
 * When the SPA is hosted on a different origin than the API (e.g. Vercel + Railway),
 * set `VITE_API_ORIGIN` to the backend base URL (no trailing slash), e.g. `https://api.example.com`.
 * Leave unset for local dev or Docker same-origin.
 */
export function resolveApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = import.meta.env.VITE_API_ORIGIN?.trim().replace(/\/$/, "") ?? "";
  if (!base) return path;
  if (!path.startsWith("/")) return `${base}/${path}`;
  return `${base}${path}`;
}

/** Same as `resolveApiUrl` — use for `/uploads/...` and other public paths served by the API. */
export function resolvePublicUrl(url: string | null | undefined): string | undefined {
  if (url == null || url === "") return undefined;
  return resolveApiUrl(url);
}
