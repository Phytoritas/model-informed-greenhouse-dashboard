const LOCAL_BACKEND_PORT_CANDIDATES = ["8000", "8003"] as const;

type BrowserLocationLike = Pick<Location, "hostname" | "origin" | "port" | "protocol" | "search">;
type BrowserStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type BrowserContextLike = {
  location: BrowserLocationLike;
  localStorage: BrowserStorageLike;
};

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function isLocalPreviewHost(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost";
}

function isStandardLocalBackendOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return (
      isLocalPreviewHost(parsed.hostname) &&
      LOCAL_BACKEND_PORT_CANDIDATES.includes(
        parsed.port as (typeof LOCAL_BACKEND_PORT_CANDIDATES)[number],
      )
    );
  } catch {
    return false;
  }
}

function clearStoredBackendOverride(storage: BrowserStorageLike): void {
  try {
    storage.removeItem("smartgrow.backendOrigin");
    storage.removeItem("smartgrow.backendOriginPinned");
  } catch {
    // Ignore storage failures and fall back to runtime defaults.
  }
}

function getBrowserContext(): BrowserContextLike | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return {
    location: window.location,
    localStorage: window.localStorage,
  };
}

function readBrowserBackendOverride(browser: BrowserContextLike): string | undefined {
  const { location, localStorage } = browser;

  try {
    const params = new URLSearchParams(location.search);
    const queryOrigin = params.get("backendOrigin")?.trim();
    if (queryOrigin) {
      const normalizedQueryOrigin = normalizeBaseUrl(queryOrigin);
      if (isStandardLocalBackendOrigin(normalizedQueryOrigin)) {
        clearStoredBackendOverride(localStorage);
      } else {
        localStorage.setItem("smartgrow.backendOrigin", normalizedQueryOrigin);
        localStorage.setItem("smartgrow.backendOriginPinned", "true");
      }
      return normalizedQueryOrigin;
    }
  } catch {
    // Ignore malformed query strings and fall back to storage/default logic.
  }

  try {
    const storedOrigin = localStorage.getItem("smartgrow.backendOrigin")?.trim();
    if (!storedOrigin) {
      return undefined;
    }
    const normalizedStoredOrigin = normalizeBaseUrl(storedOrigin);
    if (isStandardLocalBackendOrigin(normalizedStoredOrigin)) {
      clearStoredBackendOverride(localStorage);
      return undefined;
    }
    // Keep nonstandard origins so custom backend hosts survive reloads.
    return normalizedStoredOrigin;
  } catch {
    return undefined;
  }
}

export function inferDefaultBackendOrigin(browser = getBrowserContext()): string {
  if (!browser) {
    return "http://localhost:8000";
  }

  const { hostname, origin, port, protocol } = browser.location;
  const browserOverride = readBrowserBackendOverride(browser);
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

function deriveForecastWsUrl(simWsUrl: string): string {
  if (/\/ws\/sim$/i.test(simWsUrl)) {
    return simWsUrl.replace(/\/ws\/sim$/i, "/ws/forecast");
  }
  return `${toWsOrigin(BACKEND_ORIGIN)}/ws/forecast`;
}

/**
 * Backend WebSocket base URL for forecast snapshots.
 * Example: ws://localhost:8000/ws/forecast
 */
export const FORECAST_WS_URL = normalizeBaseUrl(
  (import.meta.env.VITE_FORECAST_WS_URL as string | undefined) ??
    deriveForecastWsUrl(WS_URL),
);

