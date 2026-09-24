import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';

import { resendVerification } from '@/api/auth';
import { errorMessage } from '@/api/client';
import { ThemedText } from '@/components/themed-text';

// Matches the backend's EMAIL_RESEND_COOLDOWN_SECONDS.
const CooldownSeconds = 60;

/**
 * "Resend confirmation email" link with a countdown between sends.
 */
export function ResendVerification({
  email,
  startWithCooldown = false,
}: {
  email: string;
  // True right after an email was sent (e.g. just registered).
  startWithCooldown?: boolean;
}) {
  const [secondsLeft, setSecondsLeft] = useState(
    startWithCooldown ? CooldownSeconds : 0,
  );
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (secondsLeft <= 0) {
      return;
    }

    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);

    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function resend() {
    setSending(true);
    setMessage(null);

    try {
      await resendVerification(email);
      setMessage('A new confirmation link is on its way.');
      setSecondsLeft(CooldownSeconds);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setSending(false);
    }
  }

  const disabled = sending || secondsLeft > 0 || !email;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled, busy: sending }}
        disabled={disabled}
        onPress={resend}>
        <ThemedText
          type={disabled ? 'small' : 'linkPrimary'}
          themeColor={disabled ? 'textSecondary' : undefined}>
          {sending
            ? 'Sending…'
            : secondsLeft > 0
              ? `Resend confirmation email (${secondsLeft}s)`
              : 'Resend confirmation email'}
        </ThemedText>
      </Pressable>
      {message && (
        <ThemedText type="small" themeColor="textSecondary">
          {message}
        </ThemedText>
      )}
    </>
  );
}
