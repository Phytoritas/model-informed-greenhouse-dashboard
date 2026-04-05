export type AppLocale = 'en' | 'ko';

export const LOCALE_STORAGE_KEY = 'smartgrow-dashboard-locale';

const INTL_LOCALE_BY_APP_LOCALE: Record<AppLocale, string> = {
    en: 'en-US',
    ko: 'ko-KR',
};

export function resolveAppLocale(value?: string | null): AppLocale {
    return (value ?? '').toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

export function getIntlLocale(locale: AppLocale): string {
    return INTL_LOCALE_BY_APP_LOCALE[locale];
}

function toDate(value: string | number | Date): Date {
    return value instanceof Date ? value : new Date(value);
}

export function formatLocaleDate(
    locale: AppLocale,
    value: string | number | Date,
    options?: Intl.DateTimeFormatOptions,
): string {
    const date = toDate(value);
    if (Number.isNaN(date.getTime())) {
        return typeof value === 'string' ? value : '';
    }
    return date.toLocaleDateString(getIntlLocale(locale), options);
}

export function formatLocaleTime(
    locale: AppLocale,
    value: string | number | Date,
    options?: Intl.DateTimeFormatOptions,
): string {
    const date = toDate(value);
    if (Number.isNaN(date.getTime())) {
        return typeof value === 'string' ? value : '';
    }
    return date.toLocaleTimeString(getIntlLocale(locale), options);
}

export function formatLocaleDateTime(
    locale: AppLocale,
    value: string | number | Date,
    options?: Intl.DateTimeFormatOptions,
): string {
    const date = toDate(value);
    if (Number.isNaN(date.getTime())) {
        return typeof value === 'string' ? value : '';
    }
    return date.toLocaleString(getIntlLocale(locale), options);
}
