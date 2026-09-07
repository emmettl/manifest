import { describe, expect, it } from 'vitest'
import { advanceTime, positionAt } from './playback'
import { parseStudy } from './load'
import { validateNavigation } from './agent-navigation'
import { createDemoStudy } from '../../scripts/generate-demo.mjs'
import type { TrackSegment, TrackStudy } from './types'
const fixture: TrackStudy = parseStudy(createDemoStudy())

describe('maritime playback', () => {
  const segment: TrackSegment = { id: 's', vesselId: 'v', samples: [{ time: 10, position: [179, 0] }, { time: 20, position: [-179, 2] }] }
  it('crosses the dateline along the short path', () => {
    expect(positionAt(segment, 15)).toEqual([-180, 1])
  })
  it('does not invent a position before or after a segment', () => {
    expect(positionAt(segment, 9)).toBeNull()
    expect(positionAt(segment, 21)).toBeNull()
    expect(positionAt(segment, 10)).toEqual([179, 0])
    expect(positionAt(segment, 20)).toEqual([-179, 2])
  })
  it('keeps a single observation only at its actual time', () => {
    const single = { ...segment, samples: segment.samples.slice(0, 1) }
    expect(positionAt(single, 10)).toEqual([179, 0])
    expect(positionAt(single, 11)).toBeNull()
  })
  it('wraps playback without losing the overflow', () => {
    expect(advanceTime(99, 2, 2, 100)).toBe(3)
    expect(advanceTime(50, -1, 2, 100)).toBe(50)
  })
})

describe('public study contract', () => {
  it('validates optional agent navigation before changing view state', () => {
    expect(validateNavigation({ region: 'hormuz', day: 12 })).toEqual({ region: 'hormuz', day: 12 })
    expect(() => validateNavigation({ region: 'unknown', day: 12 })).toThrow()
    expect(() => validateNavigation({ region: 'world', day: 31 })).toThrow()
    expect(() => validateNavigation({ region: 'world', day: 1, url: 'unexpected' })).toThrow()
  })
  it('accepts the complete deterministic fixture', () => {
    expect(parseStudy(fixture).vessels).toHaveLength(60_000)
    expect(fixture.segments.reduce((sum, segment) => sum + segment.samples.length, 0)).toBeGreaterThan(1_000_000)
    expect(fixture.segments.every(segment => segment.samples[0].time < fixture.duration && segment.samples.at(-1)!.time >= 0)).toBe(true)
    // Temporal load is sustained, not just a high fleet count of absent vessels.
    for (const time of [0, 10.5 * 86400, fixture.duration - 1]) {
      expect(fixture.segments.filter(segment => positionAt(segment, time)).length).toBeGreaterThan(20_000)
    }
  })
  it('rejects observed artifacts from this synthetic-only prototype', () => {
    expect(() => parseStudy({ ...fixture, source: { ...fixture.source, evidence: 'observed', publication: 'review-required' } })).toThrow('synthetic')
  })
  it('does not reinterpret aggregate presence as trajectories', () => {
    expect(() => parseStudy({ ...fixture, kind: 'presence' })).toThrow('format')
  })
  it('rejects unordered samples, invalid positions and orphan segments', () => {
    const badTime = structuredClone({ ...fixture, vessels: fixture.vessels.slice(0, 1), segments: fixture.segments.slice(0, 1) })
    badTime.segments[0].samples[1].time = badTime.segments[0].samples[0].time
    expect(() => parseStudy(badTime)).toThrow('sample')
    const badPosition = structuredClone({ ...fixture, vessels: fixture.vessels.slice(0, 1), segments: fixture.segments.slice(0, 1) })
    badPosition.segments[0].samples[0].position = [181, 0]
    expect(() => parseStudy(badPosition)).toThrow('sample')
    const orphan = structuredClone({ ...fixture, vessels: fixture.vessels.slice(0, 1), segments: fixture.segments.slice(0, 1) })
    orphan.segments[0].vesselId = 'missing'
    expect(() => parseStudy(orphan)).toThrow('segment')
  })
})
