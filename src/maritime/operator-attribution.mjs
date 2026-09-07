// This is an editorial focus list, not a live capacity ranking. Group membership
// is supplied explicitly by each dated record, never guessed from a ship name.
export const operatorGroups = [
  { id: 'msc', label: 'MSC' },
  { id: 'maersk', label: 'Maersk' },
  { id: 'cma-cgm', label: 'CMA CGM' },
  { id: 'cosco', label: 'COSCO' },
  { id: 'hapag-lloyd', label: 'Hapag-Lloyd' },
  { id: 'one', label: 'ONE' },
  { id: 'evergreen', label: 'Evergreen' },
  { id: 'hmm', label: 'HMM' },
  { id: 'yang-ming', label: 'Yang Ming' },
  { id: 'zim', label: 'ZIM' },
]

/** Syntax/check digit validation is not independent verification of a hull. */
export function normalizeImo(value) {
  const imo = String(value ?? '').trim().replace(/^IMO\s*/i, '')
  if (!/^[1-9]\d{6}$/.test(imo)) return undefined
  const checksum = [...imo.slice(0, 6)].reduce((sum, digit, index) => sum + Number(digit) * (7 - index), 0) % 10
  return checksum === Number(imo[6]) ? imo : undefined
}

const utc = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value.replace('Z', '.000Z')
const nonempty = value => typeof value === 'string' && value.trim().length > 0

/** Closed evidence contract: validity is [from, to), in UTC. No open-ended claims. */
export function validateOperatorRecord(record) {
  if (!record || normalizeImo(record.imo) !== record.imo || !record.imo ||
      ![...operatorGroups.map(group => group.id), 'other'].includes(record.groupId) ||
      !nonempty(record.operatorName) || record.role !== 'commercial-operator' ||
      !utc(record.validFrom) || !utc(record.validTo) || Date.parse(record.validFrom) >= Date.parse(record.validTo) ||
      !nonempty(record.evidenceNote) || !nonempty(record.source?.label) || !utc(record.source?.retrievedUtc) ||
      typeof record.source?.url !== 'string' || !/^https?:\/\//.test(record.source.url)) throw new Error('Invalid dated commercial-operator record.')
  try { new URL(record.source.url) } catch { throw new Error('Invalid operator source URL.') }
  return record
}

export function createOperatorLookup(registry) {
  if (registry === undefined) return () => undefined
  if (registry?.schemaVersion !== 1 || registry.publication !== 'review-required' || !Array.isArray(registry.records)) throw new Error('Operator registry must be a review-required v1 records array.')
  const byImo = new Map()
  for (const record of registry.records) {
    validateOperatorRecord(record)
    const entries = byImo.get(record.imo) ?? []
    entries.push(record); byImo.set(record.imo, entries)
  }
  for (const entries of byImo.values()) {
    entries.sort((a, b) => Date.parse(a.validFrom) - Date.parse(b.validFrom))
    for (let i = 1; i < entries.length; i++) {
      if (Date.parse(entries[i].validFrom) < Date.parse(entries[i - 1].validTo)) throw new Error('Overlapping operator evidence; resolve the conflict before compiling.')
    }
  }
  return (imo, timestamp) => byImo.get(imo)?.find(record => timestamp * 1000 >= Date.parse(record.validFrom) && timestamp * 1000 < Date.parse(record.validTo))
}

/** @param {import('./types').Vessel} vessel @param {string} filter */
export function matchesOperator(vessel, filter) {
  const id = vessel.operator?.groupId ?? 'unknown'
  if (filter === 'all') return true
  if (filter === 'top3') return operatorGroups.slice(0, 3).some(group => group.id === id)
  if (filter === 'top10') return operatorGroups.some(group => group.id === id)
  return id === filter
}

/** @param {import('./types').TrackStudy} study @param {string} filter */
export function filterOperatorStudy(study, filter) {
  if (filter === 'all') return study
  const vessels = study.vessels.filter(vessel => matchesOperator(vessel, filter))
  const ids = new Set(vessels.map(vessel => vessel.id))
  return { ...study, vessels, segments: study.segments.filter(segment => ids.has(segment.vesselId)) }
}
