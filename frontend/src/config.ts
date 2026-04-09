const LOCAL_BACKEND_PORT_CANDIDATES = ["8003", "8000"] as const;

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function isLocalPreviewHost(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost";
}

function readBrowserBackendOverride(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const queryOrigin = params.get("backendOrigin")?.trim();
    if (queryOrigin) {
      const normalizedQueryOrigin = normalizeBaseUrl(queryOrigin);
      window.localStorage.setItem("smartgrow.backendOrigin", normalizedQueryOrigin);
      return normalizedQueryOrigin;
    }
  } catch {
    // Ignore malformed query strings and fall back to storage/default logic.
  }

  try {
    const storedOrigin = window.localStorage.getItem("smartgrow.backendOrigin")?.trim();
    return storedOrigin ? normalizeBaseUrl(storedOrigin) : undefined;
  } catch {
    return undefined;
  }
}

function inferDefaultBackendOrigin(): string {
  if (typeof window === "undefined") {
    return "http://localhost:8003";
  }

  const { hostname, origin, port, protocol } = window.location;
  const browserOverride = readBrowserBackendOverride();
  if (browserOverride) {
    return browserOverride;
  }

  if (!isLocalPreviewHost(hostname)) {
    return origin;
  }

  if (
    LOCAL_BACKEND_PORT_CANDIDATES.includes(
      port as (typeof LOCAL_BACKEND_PORT_CANDIDATES)[number],
    ) ||
    port === ""
  ) {
    return origin;
  }

  const preferredPort =
    ((import.meta.env.VITE_BACKEND_PORT as string | undefined) ?? "").trim() ||
    LOCAL_BACKEND_PORT_CANDIDATES[0];

  return `${protocol}//${hostname}:${preferredPort}`;
}

const DEFAULT_BACKEND_ORIGIN = inferDefaultBackendOrigin();

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

