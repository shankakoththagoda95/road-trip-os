import type { Animated } from 'react-native';
import { useEffect, useState } from 'react';

const Duration = 240;

/**
 * Blurs and dims everything behind it (used behind popups). The blur and
 * dim ease in/out with CSS transitions; fading the element's opacity
 * instead makes browsers pop the blur in abruptly.
 */
export function BlurBackdrop({
  open,
}: {
  open: boolean;
  // Used by the native version.
  progress?: Animated.Value;
}) {
  // Start un-blurred, then switch on the next frame so the transition runs.
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const active = open && entered;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: active ? 'rgba(3, 10, 18, 0.45)' : 'rgba(3, 10, 18, 0)',
        backdropFilter: active ? 'blur(8px)' : 'blur(0px)',
        WebkitBackdropFilter: active ? 'blur(8px)' : 'blur(0px)',
        transition: `backdrop-filter ${Duration}ms ease, -webkit-backdrop-filter ${Duration}ms ease, background-color ${Duration}ms ease`,
        willChange: 'backdrop-filter, background-color',
      }}
    />
  );
}
