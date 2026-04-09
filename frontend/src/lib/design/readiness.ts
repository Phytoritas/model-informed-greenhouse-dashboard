import type { AppLocale } from '../../i18n/locale';

export type ReadinessTone = 'neutral' | 'info' | 'success' | 'warning';

export interface ReadinessDescriptor {
    lead: string;
    label: string;
    tone: ReadinessTone;
}

function normalizeReadinessValue(value: number | null | undefined): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null;
    }

    if (value > 1) {
        return Math.max(0, Math.min(1, value / 100));
    }

    return Math.max(0, Math.min(1, value));
}

export function getReadinessDescriptor(
    value: number | null | undefined,
    locale: AppLocale,
): ReadinessDescriptor {
    const readiness = normalizeReadinessValue(value);
    const lead = locale === 'ko' ? '반영 상태' : 'Readiness';

    if (readiness === null) {
        return {
            lead,
            label: locale === 'ko' ? '추가 확인 필요' : 'Needs review',
            tone: 'neutral',
        };
    }

    if (readiness >= 0.82) {
        return {
            lead,
            label: locale === 'ko' ? '바로 적용' : 'Ready to apply',
            tone: 'success',
        };
    }

    if (readiness >= 0.68) {
        return {
            lead,
            label: locale === 'ko' ? '보수 적용' : 'Guarded apply',
            tone: 'info',
        };
    }

    return {
        lead,
        label: locale === 'ko' ? '추가 확인' : 'Review first',
        tone: 'warning',
    };
}

export function formatReadinessBadge(
    value: number | null | undefined,
    locale: AppLocale,
    leadOverride?: string,
): string {
    const descriptor = getReadinessDescriptor(value, locale);
    return `${leadOverride ?? descriptor.lead}:${descriptor.label}`;
}
