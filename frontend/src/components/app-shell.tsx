import type { PropsWithChildren } from 'react';

/**
 * Native: navigation is the bottom tab bar (see app-tabs.tsx), so the shell
 * just renders the page. The web version (app-shell.web.tsx) adds the
 * sidebar.
 * TODO: revisit in the mobile pass.
 */
export function AppShell({ children }: PropsWithChildren) {
  return <>{children}</>;
}
