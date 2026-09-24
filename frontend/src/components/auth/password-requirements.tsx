import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { PasswordRules } from '@/utils/password';

/**
 * Live checklist of the password rules, shown under a new-password field.
 */
export function PasswordRequirements({ password }: { password: string }) {
  return (
    <View style={styles.list} accessibilityLabel="Password requirements">
      {PasswordRules.map((rule) => {
        const met = rule.test(password);

        return (
          <ThemedText
            key={rule.id}
            type="small"
            themeColor={met ? 'success' : 'textSecondary'}>
            {met ? '✓' : '○'} {rule.label}
          </ThemedText>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.three,
    marginTop: -Spacing.one,
  },
});
