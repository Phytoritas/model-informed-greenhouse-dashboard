export const PYEONG_TO_M2 = 3.305785;
export const DEFAULT_GREENHOUSE_AREA_M2 = 3305.8;

function normalizeFinite(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

export function pyeongToM2(value: number | null | undefined): number | null {
    const normalized = normalizeFinite(value);
    return normalized === null ? null : normalized * PYEONG_TO_M2;
}

export function m2ToPyeong(value: number | null | undefined): number | null {
    const normalized = normalizeFinite(value);
    return normalized === null ? null : normalized / PYEONG_TO_M2;
}

export function roundArea(value: number | null | undefined, digits = 2): number | null {
    const normalized = normalizeFinite(value);
    if (normalized === null) {
        return null;
    }

    const scale = 10 ** digits;
    return Math.round(normalized * scale) / scale;
}

export function parseAreaInput(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    const parsed = Number(trimmed);
    return normalizeFinite(parsed);
}
