const NETWORK_FAILURE_PATTERN =
  /failed to fetch|networkerror|load failed|err_connection_refused|fetch failed/i;

const HTTP_FAILURE_PATTERN = /^http\s*(?<status>\d{3})$/i;
const NOT_FOUND_PATTERN = /^not found$/i;

interface RequestErrorCopyOptions {
  resourceKo: string;
  resourceEn: string;
}

export function getRequestErrorCopy(
  error: string | null | undefined,
  locale: "ko" | "en",
  options: RequestErrorCopyOptions,
): string | null {
  if (!error) {
    return null;
  }

  const normalized = error.trim();
  if (!normalized) {
    return null;
  }

  if (NETWORK_FAILURE_PATTERN.test(normalized)) {
    return locale === "ko"
      ? `백엔드 연결이 없어 ${options.resourceKo} 불러오지 못했습니다.`
      : `Could not reach the backend to load ${options.resourceEn}.`;
  }

  const httpMatch = normalized.match(HTTP_FAILURE_PATTERN);
  if (httpMatch?.groups?.status) {
    const status = Number(httpMatch.groups.status);
    if (status === 404) {
      return locale === "ko"
        ? `${options.resourceKo} 값을 아직 준비하지 못했습니다.`
        : `${options.resourceEn} is not available yet.`;
    }
    if (status >= 500) {
      return locale === "ko"
        ? `${options.resourceKo} 응답이 불안정합니다. 잠시 후 다시 불러오세요.`
        : `${options.resourceEn} is temporarily unavailable. Please try again shortly.`;
    }
  }

  if (NOT_FOUND_PATTERN.test(normalized)) {
    return locale === "ko"
      ? `${options.resourceKo} 값을 아직 준비하지 못했습니다.`
      : `${options.resourceEn} is not available yet.`;
  }

  return normalized;
}
