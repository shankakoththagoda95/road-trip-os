import { Colors } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

export function useTheme() {
  const { theme } = useAppTheme();

  return Colors[theme];
}