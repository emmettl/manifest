import type { Position, TrackSegment } from './types'

export const DAY = 86400
export function wrapLongitude(value: number): number { return ((value + 180) % 360 + 360) % 360 - 180 }

/** Only interpolate inside an audited segment; never extrapolate across its ends. */
export function positionAt(segment: TrackSegment, time: number): Position | null {
  const samples = segment.samples
  if (!samples.length || time < samples[0].time || time > samples[samples.length - 1].time) return null
  let low = 0
  let high = samples.length - 1
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (samples[middle].time <= time) low = middle
    else high = middle - 1
  }
  const a = samples[low]
  const b = samples[low + 1]
  if (!b || b.time === a.time) return a.position
  const progress = (time - a.time) / (b.time - a.time)
  return [wrapLongitude(a.position[0] + wrapLongitude(b.position[0] - a.position[0]) * progress), a.position[1] + (b.position[1] - a.position[1]) * progress]
}

export function advanceTime(time: number, elapsedSeconds: number, speed: number, duration: number): number {
  return ((time + Math.max(0, elapsedSeconds) * speed) % duration + duration) % duration
}
