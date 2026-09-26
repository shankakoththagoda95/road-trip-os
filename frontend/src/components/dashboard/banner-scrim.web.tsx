// [position %, opacity] pairs, from the left edge.
export type ScrimStops = readonly (readonly [number, number])[];

const DefaultStops: ScrimStops = [
  [0, 0.95],
  [32, 0.8],
  [62, 0],
];

/**
 * Fades the banner photo behind the headline (left side) so text stays
 * readable over a busy image. `color` is "r, g, b"; pick one that matches
 * the photo so the fade looks like part of it.
 */
export function BannerScrim({
  color,
  stops = DefaultStops,
}: {
  color: string;
  stops?: ScrimStops;
}) {
  const gradient = stops
    .map(([position, opacity]) => `rgba(${color}, ${opacity}) ${position}%`)
    .join(', ');

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(to right, ${gradient})`,
      }}
    />
  );
}
