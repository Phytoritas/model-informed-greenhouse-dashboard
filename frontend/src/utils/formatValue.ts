export const resolveFractionDigits = (value: number): number => {
    const absValue = Math.abs(value);

    if (!Number.isFinite(absValue)) {
        return 1;
    }

    if (absValue === 0) {
        return 1;
    }

    if (absValue >= 100) {
        return 0;
    }

    if (absValue >= 1) {
        return 1;
    }

    if (absValue >= 0.1) {
        return 2;
    }

    if (absValue >= 0.01) {
        return 3;
    }

    return 4;
};

export const formatMetricValue = (
    value: number,
    fractionDigits?: number,
): string => {
    if (!Number.isFinite(value)) {
        return "-";
    }

    const digits = fractionDigits ?? resolveFractionDigits(value);
    return value.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
};
