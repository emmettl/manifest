import { describe, expect, it } from 'vitest'
import { compileReports } from './compile-ais.mjs'
import { normalizeNoaaRow, noaaColumns } from './noaa-sample.mjs'
import { createOperatorLookup, filterOperatorStudy, normalizeImo, operatorGroups } from '../src/maritime/operator-attribution.mjs'
import { parseStudy } from '../src/maritime/load'
import { FleetHeads } from '../src/maritime/fleet-geometry'

// Invented identity/operator records for contract tests, never actual vessel evidence.
const epoch = Date.parse('2025-01-01T00:00:00Z') / 1000
const record = (overrides = {}) => ({ imo: '1234567', groupId: 'msc', operatorName: 'Invented test operator', role: 'commercial-operator', validFrom: '2025-01-01T00:00:00Z', validTo: '2025-01-01T00:10:00Z', evidenceNote: 'Invented contract test only', source: { label: 'Invented evidence', url: 'https://example.com/test-evidence', retrievedUtc: '2026-09-07T00:00:00Z' }, ...overrides })
const registry = records => ({ schemaVersion: 1, publication: 'review-required', records })
const report = (seconds, overrides = {}) => ({ mmsi: '123456789', imo: '1234567', reportedName: 'TEST SHIP', timestamp: epoch + seconds, longitude: -118, latitude: 33, category: 'cargo', ...overrides })
const input = (reports, records = []) => ({ source: { id: 'noaa-la-2025', label: 'Invented contract test', license: 'test-only' }, startUtc: '2025-01-01T00:00:00Z', duration: 1800, reports, operatorRegistry: registry(records) })

describe('dated commercial operators', () => {
  it('preserves NOAA names and validated IMO identifiers without treating names as operators', () => {
    const columns = noaaColumns('mmsi,base_date_time,longitude,latitude,vessel_type,imo,vessel_name')
    const row = normalizeNoaaRow('123456789,2025-01-01 00:00:00,-118,33,70,IMO1234567,MSC TEST', columns)
    expect(row).toMatchObject({ imo: '1234567', reportedName: 'MSC TEST' })
    expect(compileReports(input([row])).vessels[0].operator).toBeUndefined()
    expect(normalizeImo('IMO 1234567')).toBe('1234567')
    for (const value of ['0000000', '1234568', '', 'IMO0']) expect(normalizeImo(value)).toBeUndefined()
  })
  it('matches only by IMO and uses exclusive interval ends, with no backward fill', () => {
    const lookup = createOperatorLookup(registry([record()]))
    expect(lookup('1234567', epoch - 1)).toBeUndefined()
    expect(lookup('1234567', epoch)).toMatchObject({ groupId: 'msc' })
    expect(lookup('1234567', epoch + 600)).toBeUndefined()
    expect(lookup(undefined, epoch)).toBeUndefined()
    expect(lookup('7654329', epoch)).toBeUndefined()
    const study = compileReports(input([report(0, { imo: undefined, reportedName: 'MAERSK TEST' })], [record()]))
    expect(study.vessels[0].operator).toBeUndefined()
  })
  it('splits changes and expiry of dated operator evidence without bridging them', () => {
    const study = compileReports(input([0, 300, 600, 900, 1200, 1500].map(time => report(time)), [record(), record({ groupId: 'maersk', validFrom: '2025-01-01T00:10:00Z', validTo: '2025-01-01T00:20:00Z' })]))
    expect(study.vessels.map(vessel => vessel.operator?.groupId)).toEqual(['msc', 'maersk', undefined])
    expect(study.segments.map(segment => segment.samples.map(sample => sample.time))).toEqual([[0, 300], [600, 900], [1200, 1500]])
    expect(study.audit).toMatchObject({ operatorSplits: 2, operatorAttributedVesselRecords: 2, operatorUnknownVesselRecords: 1 })
    expect(study.audit.operatorRegistrySha256).toMatch(/^[a-f0-9]{64}$/)
    expect(parseStudy(study, 'noaa-la-2025').vessels).toHaveLength(3)
  })
  it('does not reuse an attribution when the same MMSI reports a different hull', () => {
    const study = compileReports(input([report(0), report(60, { imo: '7654329' }), report(120, { imo: undefined })], [record()]))
    expect(study.vessels.map(vessel => vessel.operator?.groupId)).toEqual(['msc', undefined, undefined])
    expect(study.audit.identitySplits).toBe(2)
    expect(study.segments.map(segment => segment.samples.length)).toEqual([1, 1, 1])
  })
  it('discards simultaneous identity conflicts and retains reception gaps', () => {
    const study = compileReports(input([report(0), report(60), report(60, { imo: '7654329' }), report(120), report(480)], [record()]), { maxGapSeconds: 300 })
    expect(study.audit.conflicts).toBe(2)
    expect(study.segments.map(segment => segment.samples.map(sample => sample.time))).toEqual([[0], [120], [480]])
  })
  it('requires complete provenance and rejects ambiguous overlapping assignments', () => {
    for (const invalid of [record({ role: 'owner' }), record({ validTo: '' }), record({ groupId: 'unknown' }), record({ imo: '1234568' }), record({ source: { label: 'Bad URL', url: 'javascript:alert(1)', retrievedUtc: '2026-09-07T00:00:00Z' } }), record({ evidenceNote: '' }), record({ validFrom: '2025-02-30T00:00:00Z' })]) {
      expect(() => createOperatorLookup(registry([invalid]))).toThrow()
    }
    expect(() => createOperatorLookup(registry([record(), record({ groupId: 'maersk' })]))).toThrow('Overlapping')
  })
  it('validates hull, dates and public evidence boundaries on admission', () => {
    const study = compileReports(input([report(0), report(300)], [record()]))
    const wrongHull = structuredClone(study); wrongHull.vessels[0].operator.imo = '7654329'
    expect(() => parseStudy(wrongHull, 'noaa-la-2025')).toThrow('IMO')
    const expired = structuredClone(study); expired.segments[0].samples[1].time = 600
    expect(() => parseStudy(expired, 'noaa-la-2025')).toThrow('operator evidence interval')
    const synthetic = structuredClone(study)
    synthetic.source = { ...synthetic.source, evidence: 'synthetic', publication: 'synthetic-only' }
    synthetic.vessels[0].evidence = 'synthetic'
    expect(() => parseStudy(synthetic)).toThrow('local review')
  })
  it('uses the same filtered geometry for marks and picking, including Unknown and all ten groups', () => {
    const study = compileReports(input([report(0), report(300), report(0, { mmsi: '987654321', imo: undefined, longitude: -118.5 }), report(300, { mmsi: '987654321', imo: undefined, longitude: -118.5 })], [record()]))
    const known = filterOperatorStudy(study, 'msc')
    expect(known.vessels).toHaveLength(1)
    expect(known.segments).toHaveLength(1)
    expect(filterOperatorStudy(study, 'unknown').vessels.map(vessel => vessel.mmsi)).toEqual(['987654321'])
    expect(filterOperatorStudy(study, 'all')).toBe(study)
    for (const group of operatorGroups) {
      const grouped = compileReports(input([report(0)], [record({ groupId: group.id })]))
      expect(filterOperatorStudy(grouped, group.id).vessels).toHaveLength(1)
      expect(filterOperatorStudy(grouped, 'top10').vessels).toHaveLength(1)
    }
    expect(filterOperatorStudy(study, 'top3').vessels).toHaveLength(1)
    const view = { time: 150, visible: new Set(['cargo']), selected: null, camera: { longitude: -118, latitude: 33, zoom: 85 }, size: { width: 1200, height: 600 } }
    expect(new FleetHeads(known).pick(view, 600, 300)).toBe(known.vessels[0].id)
    expect(new FleetHeads(filterOperatorStudy(study, 'maersk')).update(view)).toBe(0)
    expect(new FleetHeads(filterOperatorStudy(study, 'maersk')).pick(view, 600, 300)).toBeNull()
  })
})
