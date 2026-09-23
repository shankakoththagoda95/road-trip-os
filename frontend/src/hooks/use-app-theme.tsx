import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';

export type AppTheme = 'light' | 'dark';

type AppThemeContextValue = {
  theme: AppTheme;
  toggleTheme: () => void;
};

const AppThemeContext = createContext<AppThemeContextValue | undefined>(
  undefined,
);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemTheme = useColorScheme();

  const [theme, setTheme] = useState<AppTheme>(
    systemTheme === 'dark' ? 'dark' : 'light',
  );

  const [hasUserPreference, setHasUserPreference] = useState(false);

  useEffect(() => {
    if (!hasUserPreference && systemTheme !== 'unspecified') {
      setTheme(systemTheme === 'dark' ? 'dark' : 'light');
    }
  }, [systemTheme, hasUserPreference]);

  function toggleTheme() {
    setHasUserPreference(true);
    setTheme((currentTheme) =>
      currentTheme === 'dark' ? 'light' : 'dark',
    );
  }

  return (
    <AppThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);

  if (!context) {
    throw new Error('useAppTheme must be used inside AppThemeProvider');
  }

  return context;
}