/** Shared by the renderer and gesture math so the point under a pinch stays fixed. */
export function projectionScale({ width, height }: { width: number; height: number }): number {
  // A desktop overview spans one world horizontally; height may crop the polar margins.
  // Fitting by height made a shallow desktop canvas show multiple tiny world copies.
  if (width > 700) return width / 360
  return Math.min(width / 360, height / 150) * .9
}
