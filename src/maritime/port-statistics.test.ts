import { expect, it } from 'vitest'
import { ports, searchPorts } from './port-labels'
import { formatPortMetric, freightPeriods, freightRanking, portProfiles, statisticSources } from './port-statistics'

it('keeps sourced metrics attached to real catalogue ports, with explicit periods and units', () => {
  for (const [id, profile] of Object.entries(portProfiles)) {
    expect(ports.some(port => port.id === id), id).toBe(true)
    expect(profile.scope.length).toBeGreaterThan(0)
    expect(new Set(profile.metrics.map(metric => metric.kind)).size).toBe(profile.metrics.length)
    for (const metric of profile.metrics) {
      expect(Number.isFinite(metric.value) && metric.value > 0).toBe(true)
      expect(metric.period).toMatch(/20\d\d/)
      expect(metric.unit).toBe(({ containers: 'million TEU', containerRank: 'rank', cargo: 'million tonnes', arrivals: 'arrivals' })[metric.kind])
      expect(statisticSources[metric.source].url).toMatch(/^https:\/\//)
    }
  }
})

it('covers the container baseline without attributing an aggregate ranking to a terminal alone', () => {
  const ranked = ports.filter(port => port.containerRank2024)
  expect(ranked).toHaveLength(50)
  for (const port of ranked) {
    const rank = portProfiles[port.id].metrics.find(metric => metric.kind === 'containerRank')!
    expect(rank.value).toBe(port.containerRank2024)
    expect(rank.period).toBe('2024')
  }
  expect(portProfiles.yantian.scope).toBe('Shenzhen')
  expect(portProfiles.yantian.scopeNote).toContain('port system')
  expect(portProfiles['cai-mep'].scopeNote).toContain('CMIT')
  expect(portProfiles['port-hedland'].metrics).toHaveLength(1)
  // Authority-wide visits must never be presented as port-specific arrivals.
  expect(portProfiles['port-hedland'].metrics[0].kind).toBe('cargo')
  expect(portProfiles.palermo.metrics.find(metric => metric.kind === 'cargo')?.value).toBe(8.07095)
  expect(portProfiles['ras-tanura']).toBeUndefined()
})

it('covers the expanded catalogue and keeps breakdown parts in the total’s units', () => {
  expect(Object.keys(portProfiles).length).toBeGreaterThanOrEqual(131)
  for (const [id, profile] of Object.entries(portProfiles)) {
    for (const metric of profile.metrics) {
      if (!metric.breakdown) continue
      expect(metric.kind, id).not.toBe('containerRank')
      expect(new Set(metric.breakdown.map(part => part.label)).size, id).toBe(metric.breakdown.length)
      for (const part of metric.breakdown) {
        expect(Number.isFinite(part.value) && part.value >= 0 && part.value <= metric.value, id).toBe(true)
      }
      const total = metric.breakdown.reduce((sum, part) => sum + part.value, 0)
      // Independently rounded source categories may differ slightly from their total.
      expect(Math.abs(total - metric.value) / metric.value, id).toBeLessThan(.001)
    }
  }
})

it('ranks only matching measures and periods, deduplicating shared reporting systems', () => {
  const rows = freightRanking('containers', '2024')
  expect(rows.every(row => row.metric.kind === 'containers' && row.metric.period === '2024')).toBe(true)
  expect(rows.map(row => row.metric.value)).toEqual(rows.map(row => row.metric.value).sort((a, b) => b - a))
  const alliance = rows.filter(row => row.scope === 'Seattle–Tacoma')
  expect(alliance).toHaveLength(1)
  expect(alliance[0].portIds.sort()).toEqual(['seattle', 'tacoma'])
  expect(freightRanking('cargo', 'no such period')).toEqual([])
  expect(freightPeriods('cargo')).toContain('FY 2025–26')
  expect(freightRanking('cargo', '2024').some(row => row.portIds.includes('port-hedland'))).toBe(false)
  expect(freightRanking('cargo').some(row => row.portIds.includes('port-hedland'))).toBe(true)
})

it('formats units faithfully and finds punctuation/alias variants', () => {
  expect(formatPortMetric(portProfiles.shanghai.metrics[0])).toBe('51.51')
  expect(formatPortMetric(portProfiles.shanghai.metrics[1])).toBe('#1')
  expect(formatPortMetric(portProfiles['los-angeles'].metrics[2])).toBe('1,807')
  expect(searchPorts('new jersey')[0].id).toBe('new-york')
  expect(searchPorts('Ningbo Zhoushan')[0].id).toBe('ningbo-zhoushan')
  expect(searchPorts('cái mép')[0].id).toBe('cai-mep')
})
