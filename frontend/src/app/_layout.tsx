import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AppThemeProvider, useAppTheme } from '@/hooks/use-app-theme';
import { SessionProvider, useSession } from '@/hooks/use-session';

SplashScreen.preventAutoHideAsync();

function AppNavigation() {
  const { theme } = useAppTheme();
  const { session } = useSession();

  // Keep the splash screen up until we know whether the user is signed in.
  if (session.status === 'loading') {
    return null;
  }

  const signedIn = session.status === 'signedIn';

  return (
    <ThemeProvider value={theme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />

      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="trips/new" />
        </Stack.Protected>

        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="check-email" />
          <Stack.Screen name="forgot-password" />
        </Stack.Protected>

        {/* Opened from emailed links, whether or not someone is signed in. */}
        <Stack.Screen name="verify-email" />
        <Stack.Screen name="reset-password" />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <SessionProvider>
        <AppNavigation />
      </SessionProvider>
    </AppThemeProvider>
  );
}
