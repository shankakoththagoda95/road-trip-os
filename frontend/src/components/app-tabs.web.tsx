import { Slot } from 'expo-router';

/**
 * Web: the Home / Trips links live in the sidebar
 * (components/app-shell.web.tsx), so the tab group just renders its page.
 */
export default function AppTabs() {
  return <Slot />;
}
