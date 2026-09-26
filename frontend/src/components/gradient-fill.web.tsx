/**
 * Fills its parent with a CSS linear gradient (place it first, absolutely).
 */
export function GradientFill({
  from,
  to,
  angle = 90,
}: {
  from: string;
  to: string;
  angle?: number;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(${angle}deg, ${from}, ${to})`,
      }}
    />
  );
}
