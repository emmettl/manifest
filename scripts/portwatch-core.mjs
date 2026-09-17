export const categories = ['all', 'container', 'dry_bulk', 'general_cargo', 'roro', 'tanker']
export const dayMs = 86_400_000

export function isoDay(value) {
  if (typeof value !== 'number' && typeof value !== 'string') throw new Error('Missing source date')
  const date = new Date(value)
  if (!Number.isFinite(+date)) throw new Error('Invalid source date')
  const result = date.toISOString().slice(0, 10)
  if (typeof value === 'string' && value !== result) throw new Error('Expected ISO calendar date')
  return result
}

export function daysBetween(start, end) {
  isoDay(start); isoDay(end)
  const count = (Date.parse(end) - Date.parse(start)) / dayMs + 1
  if (count < 1 || count > 366) throw new Error('Study must contain 1–366 days')
  return Array.from({ length: count }, (_, i) => new Date(Date.parse(start) + i * dayMs).toISOString().slice(0, 10))
}

function values(row, prefix, total, integer = false) {
  return categories.map(category => {
    const key = category === 'all' ? total : `${prefix}_${category}`
    if (!(key in row)) throw new Error(`Missing source field ${key}`)
    const n = row[key]
    if (n === null) return null
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || (integer && !Number.isInteger(n))) throw new Error(`Invalid ${key}: ${n}`)
    return n
  })
}

/** Never joins ports to one another or treats cargo subtotals as extra vessels. */
export function compileLocation(meta, kind, rows, dates) {
  if (!['port', 'chokepoint'].includes(kind) || !meta.portid || !meta.portname || !Number.isFinite(meta.lat) || !Number.isFinite(meta.lon) || Math.abs(meta.lat) > 90 || Math.abs(meta.lon) > 180) throw new Error('Invalid location')
  const byDate = new Map()
  const allowed = new Set(dates)
  for (const row of rows) {
    const date = isoDay(row.date)
    if (row.portid !== meta.portid || !allowed.has(date)) throw new Error('Record outside requested scope')
    if (byDate.has(date)) throw new Error(`Duplicate location/day: ${meta.portid} ${date}`)
    byDate.set(date, {
      calls: values(row, kind === 'port' ? 'portcalls' : 'n', kind === 'port' ? 'portcalls' : 'n_total', true),
      ...(kind === 'port' ? { imports: values(row, 'import', 'import'), exports: values(row, 'export', 'export') } : { transit: values(row, 'capacity', 'capacity') }),
    })
  }
  return { id: meta.portid, name: meta.portname, country: meta.country ?? null, kind, position: /** @type {[number, number]} */ ([meta.lon, meta.lat]), days: dates.map(date => byDate.get(date) ?? null) }
}

/** Validate the independent aggregate contract, never admit it as vessel tracks. */
export function validatePortwatch(study) {
  if (study?.schemaVersion !== 1 || study.kind !== 'portwatch-activity' || study.source?.id !== 'imf-portwatch' || study.source?.evidence !== 'ais-derived-aggregate' || !Array.isArray(study.locations) || !study.locations.length) throw new Error('Invalid PortWatch study')
  const expected = daysBetween(study.start, study.end)
  if (JSON.stringify(study.dates) !== JSON.stringify(expected)) throw new Error('Non-contiguous study calendar')
  if (typeof study.source.capturedUtc !== 'string' || !Number.isFinite(Date.parse(study.source.capturedUtc)) || typeof study.source.attribution !== 'string' || !study.audit || !Number.isInteger(study.audit.availableDays) || !Number.isInteger(study.audit.expectedDays)) throw new Error('Missing source/audit metadata')
  if (!study.baseline || daysBetween(study.baseline.start, study.baseline.end).length !== study.baseline.days || study.baseline.start < study.start || study.baseline.end > study.end) throw new Error('Invalid baseline interval')
  const ids = new Set()
  for (const location of study.locations) {
    if (ids.has(location.id) || typeof location.id !== 'string' || typeof location.name !== 'string' || !['port', 'chokepoint'].includes(location.kind) || !Array.isArray(location.position) || location.position.length !== 2 || !location.position.every(Number.isFinite) || Math.abs(location.position[0]) > 180 || Math.abs(location.position[1]) > 90) throw new Error('Invalid location identity')
    ids.add(location.id)
    if (!Array.isArray(location.days) || location.days.length !== expected.length) throw new Error('Invalid location calendar')
    for (const day of location.days) {
      if (day === null) continue
      for (const key of location.kind === 'port' ? ['calls', 'imports', 'exports'] : ['calls', 'transit']) {
        if (!Array.isArray(day[key]) || day[key].length !== categories.length || !day[key].every(n => n === null || (typeof n === 'number' && Number.isFinite(n) && n >= 0 && (key !== 'calls' || Number.isInteger(n))))) throw new Error('Invalid daily metric')
      }
    }
  }
  return study
}
