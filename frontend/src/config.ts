const DEFAULT_BACKEND_HOST =
  typeof window !== "undefined" &&
  (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost")
    ? window.location.hostname
    : "localhost";

const DEFAULT_BACKEND_ORIGIN = `http://${DEFAULT_BACKEND_HOST}:8000`;

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function toWsOrigin(httpOrigin: string): string {
  try {
    const u = new URL(httpOrigin);
    if (u.protocol === "https:") u.protocol = "wss:";
    else if (u.protocol === "http:") u.protocol = "ws:";
    // otherwise, keep as-is
    return u.toString().replace(/\/+$/, "");
  } catch {
    // Fallback: naive replacement
    return httpOrigin.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:");
  }
}

const BACKEND_ORIGIN = normalizeBaseUrl(
  (import.meta.env.VITE_BACKEND_ORIGIN as string | undefined) ??
    DEFAULT_BACKEND_ORIGIN,
);

/**
 * Backend REST API base URL.
 * Example: http://localhost:8000/api
 */
export const API_URL = normalizeBaseUrl(
  (import.meta.env.VITE_API_URL as string | undefined) ?? `${BACKEND_ORIGIN}/api`,
);

/**
 * Backend WebSocket base URL for simulation stream.
 * Example: ws://localhost:8000/ws/sim
 */
export const WS_URL = normalizeBaseUrl(
  (import.meta.env.VITE_WS_URL as string | undefined) ??
    `${toWsOrigin(BACKEND_ORIGIN)}/ws/sim`,
);

