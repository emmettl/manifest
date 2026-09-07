import { describe, expect, it } from 'vitest'
import { csvFields, noaaColumns, normalizeNoaaRow, selectReview, selectLand } from './noaa-sample.mjs'
import { compileReports } from './compile-ais.mjs'

const epoch = Date.parse('2025-01-01T00:00:00Z') / 1000
const columns = noaaColumns('mmsi,base_date_time,longitude,latitude,vessel_type')
const report = (time, longitude = -118, category = 'cargo') => ({ mmsi: '123456789', timestamp: epoch + time, longitude, latitude: 33, category })
const input = reports => ({ source: { id: 'test', label: 'Invented test data', license: 'test-only' }, startUtc: '2025-01-01T00:00:00Z', duration: 86400, reports })

describe('NOAA adapter', () => {
  it('uses header names for coordinates and parses UTC independently of host timezone', () => {
    const reordered = noaaColumns('latitude,vessel_type,base_date_time,mmsi,longitude')
    expect(normalizeNoaaRow('33,70,2025-01-01 00:00:00,123456789,-118', reordered)).toEqual(report(0))
  })
  it('preserves missing coordinates as invalid rather than inventing positions at zero', () => {
    const row = normalizeNoaaRow('123456789,2025-01-01 00:00:00,,33,80', columns)
    expect(row.longitude).toBeNaN()
    expect(compileReports(input([row])).audit.rejected).toBe(1)
  })
  it('rejects invalid calendar dates rather than rolling them into another month', () => {
    expect(normalizeNoaaRow('123456789,2025-02-30 00:00:00,-118,33,70', columns).timestamp).toBeNaN()
  })
  it('retains complete coastline rings, including holes, and excludes remote polygons', () => {
    const near = [[[-119, 33], [-118, 33], [-118, 34], [-119, 33]], [[-118.8, 33.2], [-118.7, 33.2], [-118.8, 33.3], [-118.8, 33.2]]]
    const far = [[[10, 10], [11, 10], [11, 11], [10, 10]]]
    const land = { features: [{ geometry: { type: 'MultiPolygon', coordinates: [near, far] } }] }
    expect(selectLand(land).features.map(feature => feature.geometry.coordinates)).toEqual([near])
  })
  it('handles CSV quoting and rejects malformed or unknown schemas', () => {
    expect(csvFields('a,"SHIP, NAME","A""B",')).toEqual(['a', 'SHIP, NAME', 'A"B', ''])
    expect(() => csvFields('"broken')).toThrow()
    expect(() => csvFields('"a"b,c')).toThrow()
    expect(() => noaaColumns('MMSI,LAT,LON')).toThrow('2025')
    expect(() => normalizeNoaaRow('123,2025-01-01 00:00:00', columns)).toThrow('fields')
  })
  it('maps only the documented broad numeric classes and keeps unknowns as other', () => {
    for (const [code, category] of [['70', 'cargo'], ['79', 'cargo'], ['80', 'tanker'], ['89', 'tanker'], ['', 'other'], ['7', 'other'], ['81.5', 'other'], ['30', 'other']]) {
      expect(normalizeNoaaRow(`123456789,2025-01-01 00:00:00,-118,33,${code}`, columns).category).toBe(category)
    }
  })
})

describe('observed regional continuity', () => {
  it('splits a short exit and re-entry even when both in-bounds samples pass gap/speed checks', () => {
    const study = compileReports(input([report(0, -117.001), report(60, -116.999), report(120, -117.001)]), { bounds: [-120, 32.5, -117, 34.5] })
    expect(study.segments.map(segment => segment.samples.map(sample => sample.time))).toEqual([[0], [120]])
    expect(study.audit.outsideBounds).toBe(1)
  })
  it('keeps class changes in separate time-bounded episodes and cannot backfill a later class', () => {
    const study = compileReports(input([report(0, -118, 'other'), report(60, -118, 'cargo'), report(120, -118, 'tanker')]))
    expect(study.vessels.map(vessel => vessel.category)).toEqual(['other', 'cargo', 'tanker'])
    expect(new Set(study.segments.map(segment => segment.vesselId)).size).toBe(3)
    expect(study.audit.classSplits).toBe(2)
    const review = selectReview(study)
    expect(review.segments.flatMap(segment => segment.samples.map(sample => sample.time))).toEqual([60, 120])
    expect(review.source.publication).toBe('review-required')
    expect(review.selection.omittedVessels).toBe(1)
  })
  it('discards class conflicts at the same timestamp rather than choosing arbitrarily', () => {
    const study = compileReports(input([report(0), report(60, -118, 'cargo'), report(60, -118, 'tanker'), report(120)]))
    expect(study.audit.conflicts).toBe(2)
    expect(study.segments.map(segment => segment.samples.map(sample => sample.time))).toEqual([[0], [120]])
  })
  it('measures gaps and splits beyond the chosen ten-minute cap', () => {
    const study = compileReports(input([report(0), report(180), report(780), report(1381)]), { maxGapSeconds: 600 })
    expect(study.audit.gapsSeconds).toMatchObject({ p50: 600, max: 601, count: 3 })
    expect(study.audit.gapThresholdCounts['600']).toBe(1)
    expect(study.segments.map(segment => segment.samples.length)).toEqual([3, 1])
  })
})
