// Delivery windows retain original segment IDs and samples. A boundary is not a
// reception gap, and halo samples must never join distinct accepted segments.
export const DAY = 86400
export const TRAIL_SECONDS = 3 * DAY
export function sliceTrackWindow(study, start, end, lookback = TRAIL_SECONDS) {
  return study.segments.filter(segment => segment.samples[0].time < end && segment.samples.at(-1).time >= start).map(segment => {
    const samples = segment.samples
    let first = 0
    while (first + 1 < samples.length && samples[first + 1].time <= start - lookback) first++
    let last = first
    while (last < samples.length - 1 && samples[last].time < end) last++
    return { ...segment, samples: samples.slice(first, last + 1) }
  })
}
export function encodeSegments(segments, vesselIndices) {
  return segments.map(segment => [segment.id, vesselIndices.get(segment.vesselId), segment.originPortId ?? null, segment.destinationPortId ?? null, segment.samples.flatMap(sample => [sample.time, ...sample.position])])
}
