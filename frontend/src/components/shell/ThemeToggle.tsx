import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleProvider';

type Theme = 'light' | 'dark';
const storageKey = 'phytosync-theme';

export default function ThemeToggle() {
  const { locale } = useLocale();
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try { localStorage.setItem(storageKey, theme); } catch { /* Theme still works in this tab. */ }
  }, [theme]);

  return (
    <div className="phyto-theme-toggle" role="group" aria-label={locale === 'ko' ? '화면 테마' : 'Color theme'}>
      {(['light', 'dark'] as const).map(value => (
        <button
          key={value}
          type="button"
          className="phyto-theme-option"
          aria-pressed={theme === value}
          aria-label={locale === 'ko' ? (value === 'light' ? '밝은 테마' : '어두운 테마') : (value === 'light' ? 'Light theme' : 'Dark theme')}
          title={locale === 'ko' ? (value === 'light' ? '밝은 테마' : '어두운 테마') : (value === 'light' ? 'Light theme' : 'Dark theme')}
          onClick={() => setTheme(value)}
        >
          {value === 'light' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
        </button>
      ))}
    </div>
  );
}
