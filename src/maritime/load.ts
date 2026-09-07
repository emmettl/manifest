import type { LandCollection, TrackStudy } from './types'
import { normalizeImo, validateOperatorRecord } from './operator-attribution.mjs'

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'
export function parseStudy(value: unknown, localReviewSource?: 'noaa-la-2025'): TrackStudy {
  if (!object(value) || value.schemaVersion !== 1 || value.kind !== 'tracks' || !object(value.source) || !Array.isArray(value.vessels) || !Array.isArray(value.segments)) throw new Error('Unsupported study format.')
  if (typeof value.startUtc !== 'string' || !Number.isFinite(Date.parse(value.startUtc)) || typeof value.duration !== 'number' || !Number.isFinite(value.duration) || value.duration <= 0) throw new Error('Invalid study interval.')
  // Default/public admission stays synthetic. The dev-only caller pins one local source.
  const observedReview = localReviewSource === 'noaa-la-2025' && value.source.id === localReviewSource && value.source.evidence === 'observed' && value.source.publication === 'review-required'
  if ((!observedReview && (value.source.evidence !== 'synthetic' || value.source.publication !== 'synthetic-only')) || typeof value.source.license !== 'string' || !value.source.license) throw new Error('This prototype requires an explicitly synthetic fixture or the pinned local NOAA review.')
  if (localReviewSource && !observedReview) throw new Error('Expected the pinned observed NOAA review, not a substitute fixture.')
  if (typeof value.source.label !== 'string' || typeof value.source.id !== 'string') throw new Error('Missing source identity.')
  const epoch = Date.parse(value.startUtc)
  const ids = new Set<string>()
  const operators = new Map<string, { validFrom: string; validTo: string }>()
  for (const vessel of value.vessels) {
    if (!object(vessel) || typeof vessel.id !== 'string' || ids.has(vessel.id) || typeof vessel.label !== 'string' || !['cargo', 'tanker', 'other'].includes(String(vessel.category)) || vessel.evidence !== value.source.evidence) throw new Error('Invalid vessel record.')
    ids.add(vessel.id)
    if (vessel.mmsi !== undefined && (typeof vessel.mmsi !== 'string' || !/^\d{9}$/.test(vessel.mmsi))) throw new Error('Invalid vessel MMSI.')
    if (vessel.imo !== undefined && (!vessel.imo || normalizeImo(vessel.imo) !== vessel.imo)) throw new Error('Invalid vessel IMO.')
    if (vessel.reportedName !== undefined && (typeof vessel.reportedName !== 'string' || !vessel.reportedName.trim())) throw new Error('Invalid reported vessel name.')
    if (vessel.operator !== undefined) {
      if (!observedReview) throw new Error('Real operator attribution is restricted to observed local review.')
      const record = validateOperatorRecord(vessel.operator)
      if (record.imo !== vessel.imo) throw new Error('Operator attribution does not match vessel IMO.')
      operators.set(vessel.id, record)
    }
  }
  const segmentIds = new Set<string>()
  for (const segment of value.segments) {
    if (!object(segment) || typeof segment.id !== 'string' || segmentIds.has(segment.id) || !ids.has(String(segment.vesselId)) || !Array.isArray(segment.samples) || !segment.samples.length) throw new Error('Invalid track segment.')
    segmentIds.add(segment.id)
    let previous = -Infinity
    for (const sample of segment.samples) {
      if (!object(sample) || typeof sample.time !== 'number' || !Number.isFinite(sample.time) || sample.time <= previous || !Array.isArray(sample.position) || sample.position.length !== 2 || !sample.position.every(Number.isFinite) || Math.abs(sample.position[0]) > 180 || Math.abs(sample.position[1]) > 90) throw new Error('Invalid track sample.')
      if (observedReview && (sample.time < 0 || sample.time > value.duration)) throw new Error('Observed sample outside study interval.')
      const operator = operators.get(String(segment.vesselId))
      const timestamp = epoch + sample.time * 1000
      if (operator && (timestamp < Date.parse(operator.validFrom) || timestamp >= Date.parse(operator.validTo))) throw new Error('Track sample outside operator evidence interval.')
      previous = sample.time
    }
  }
  return value as unknown as TrackStudy
}

export function parseLand(value: unknown): LandCollection {
  if (!object(value) || value.type !== 'FeatureCollection' || !Array.isArray(value.features)) throw new Error('Invalid land geometry.')
  for (const feature of value.features) {
    if (!object(feature) || !object(feature.geometry) || !['Polygon', 'MultiPolygon'].includes(String(feature.geometry.type)) || !Array.isArray(feature.geometry.coordinates)) throw new Error('Invalid land feature.')
  }
  return value as unknown as LandCollection
}
