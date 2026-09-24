import {
  createContext,
  type PropsWithChildren,
  useContext,
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

  // Follows the system theme until the user picks one explicitly.
  const [userTheme, setUserTheme] = useState<AppTheme | null>(null);
  const theme: AppTheme =
    userTheme ?? (systemTheme === 'dark' ? 'dark' : 'light');

  function toggleTheme() {
    setUserTheme(theme === 'dark' ? 'light' : 'dark');
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