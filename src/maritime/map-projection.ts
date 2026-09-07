/** Shared by the renderer and gesture math so the point under a pinch stays fixed. */
export function projectionScale({ width, height }: { width: number; height: number }): number {
  // Fill wide windows without repeated worlds, and tall windows without empty polar space.
  // The latitude band is centred on the main shipping field; gesture math uses this too.
  if (width > 700) return Math.max(width / 360, height / 130)
  return Math.min(width / 360, height / 150) * .9
}
