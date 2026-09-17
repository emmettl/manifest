import { describe, expect, it } from 'vitest'
import { compileLocation, daysBetween } from '../../scripts/portwatch-core.mjs'
import { dailyValue, mean, relativeChange, seriesPath, trailingMean } from './portwatch'

const dates = daysBetween('2024-02-28', '2024-03-06')
const meta = { portid: 'test', portname: 'Test passage', lat: 12, lon: 43 }
const row = (date: string, n: number | null = 4) => ({ date, portid: 'test', n_total: n, n_container: n, n_dry_bulk: 0, n_general_cargo: 0, n_roro: 0, n_tanker: 0, capacity: 500, capacity_container: 500, capacity_dry_bulk: 0, capacity_general_cargo: 0, capacity_roro: 0, capacity_tanker: 0 })
describe('PortWatch evidence boundaries', () => {
  it('retains leap day, missing days, null measures, and real zeros distinctly', () => {
    expect(dates).toHaveLength(8)
    expect(dates[1]).toBe('2024-02-29')
    const location = compileLocation(meta, 'chokepoint', [row(dates[0], 0), row(dates[2], null)], dates)
    expect(location.days[1]).toBeNull()
    expect(dailyValue(location, 0, 'calls', 0)).toBe(0)
    expect(dailyValue(location, 2, 'calls', 0)).toBeNull()
    expect(dailyValue(location, 0, 'imports', 0)).toBeNull()
  })
  it('rejects duplicates, out-of-scope records, negatives and changed schemas', () => {
    expect(() => compileLocation(meta, 'chokepoint', [row(dates[0]), row(dates[0])], dates)).toThrow(/Duplicate/)
    expect(() => compileLocation(meta, 'chokepoint', [row('2023-01-01')], dates)).toThrow(/scope/)
    expect(() => compileLocation(meta, 'chokepoint', [row(dates[0], -1)], dates)).toThrow(/Invalid/)
    const changed = row(dates[0]) as Record<string, unknown>; delete changed.n_tanker
    expect(() => compileLocation(meta, 'chokepoint', [changed], dates)).toThrow(/Missing/)
  })
  it('uses provider totals without adding overlapping cargo subtotals', () => {
    const location = compileLocation(meta, 'chokepoint', [{ ...row(dates[0], 10), n_cargo: 10 }], dates)
    expect(dailyValue(location, 0, 'calls', 0)).toBe(10)
  })
  it('requires seven complete days for smoothing and refuses a zero baseline', () => {
    const location = compileLocation(meta, 'chokepoint', dates.map(date => row(date)), dates)
    expect(trailingMean(location, 5, 'calls', 0)).toBeNull()
    expect(trailingMean(location, 6, 'calls', 0)).toBe(4)
    location.days[3] = null
    expect(trailingMean(location, 6, 'calls', 0)).toBeNull()
    expect(mean([0, 4])).toBe(2)
    expect(mean([null, 4])).toBeNull()
    expect(relativeChange(0, 4)).toBe(-100)
    expect(relativeChange(4, 0)).toBeNull()
  })
  it('breaks chart lines across missing measurements', () => {
    expect(seriesPath([1, null, 2, 3], 90, 30, 3).match(/M/g)).toHaveLength(2)
    expect(() => daysBetween('2024-02-30', '2024-03-02')).toThrow()
  })
})
