import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react';

type Theme = 'dark' | 'light' | 'system';

type ThemeProviderProps = {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'yarotech-ui-theme',
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : defaultTheme;
    } catch {
      return defaultTheme;
    }
  });

  // Mounted only by the tenant/admin shell. Reset before public content paints,
  // including when signing out or following a storefront link in the same tab.
  useLayoutEffect(() => {
    const root = window.document.documentElement;
    const media = theme === 'system' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const apply = () => {
      root.classList.remove('light', 'dark');
      root.classList.add(theme === 'system' ? (media?.matches ? 'dark' : 'light') : theme);
    };
    apply();
    media?.addEventListener('change', apply);
    return () => {
      media?.removeEventListener('change', apply);
      root.classList.remove('dark');
      root.classList.add('light');
    };
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      try {
        localStorage.setItem(storageKey, theme);
      } catch {
        // Theme switching still works when browser storage is unavailable.
      }
      setTheme(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};
