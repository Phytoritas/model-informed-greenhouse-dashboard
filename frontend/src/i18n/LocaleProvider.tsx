import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LOCALE_STORAGE_KEY, resolveAppLocale } from './locale';
import type { AppLocale } from './locale';

interface LocaleContextValue {
    locale: AppLocale;
    setLocale: (locale: AppLocale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function resolveInitialLocale(): AppLocale {
    if (typeof window === 'undefined') {
        return 'en';
    }

    try {
        const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
        if (storedLocale) {
            return resolveAppLocale(storedLocale);
        }
    } catch {
        // Ignore storage errors and keep the farmer-facing Korean default.
    }

    return 'ko';
}

export const LocaleProvider = ({ children }: { children: ReactNode }) => {
    const [locale, setLocale] = useState<AppLocale>(resolveInitialLocale);

    useEffect(() => {
        try {
            window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
        } catch {
            // Ignore storage errors.
        }

        if (typeof document !== 'undefined') {
            document.documentElement.lang = locale;
            document.documentElement.dataset.locale = locale;
        }
    }, [locale]);

    const value = useMemo(
        () => ({
            locale,
            setLocale,
        }),
        [locale],
    );

    return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export function useLocale(): LocaleContextValue {
    const context = useContext(LocaleContext);
    if (!context) {
        throw new Error('useLocale must be used within LocaleProvider.');
    }

    return context;
}
