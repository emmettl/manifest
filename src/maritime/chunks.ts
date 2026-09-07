import { parseStudy } from './load'
import type { TrackStudy, Vessel, TrackSegment } from './types'

export interface Asset { path: string; sha256: string; bytes: number }
export interface Chunk extends Asset { start: number; end: number; segmentCount: number; sampleCount: number }
export interface TrackManifest extends Omit<TrackStudy, 'kind' | 'vessels' | 'segments'> {
  kind: 'track-manifest'
  vesselCount: number
  sampleCount: number
  lookbackSeconds: number
  catalogue: Asset
  chunks: Chunk[]
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const sourceMatches = (a: unknown, b: TrackManifest['source']) => object(a) && a.id === b.id && a.evidence === b.evidence && a.publication === b.publication && a.license === b.license && a.label === b.label
export function parseManifest(value: unknown): TrackManifest {
  if (!object(value) || value.kind !== 'track-manifest' || typeof value.id !== 'string' || !Array.isArray(value.chunks) || !value.chunks.length || !integer(value.vesselCount) || !integer(value.sampleCount) || !integer(value.lookbackSeconds) || value.lookbackSeconds < 3 * 86400) throw new Error('Invalid track manifest.')
  parseStudy({ ...value, kind: 'tracks', vessels: [], segments: [] })
  const paths = new Set<string>()
  const asset = (entry: unknown, pattern: RegExp) => {
    if (!object(entry) || typeof entry.path !== 'string' || !pattern.test(entry.path) || paths.has(entry.path) || typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256) || !integer(entry.bytes) || entry.bytes === 0 || entry.bytes > 8 * 1024 * 1024) throw new Error('Invalid chunk asset.')
    if (!entry.path.endsWith(`-${entry.sha256.slice(0, 12)}.json`)) throw new Error('Asset name must match its hash.')
    paths.add(entry.path)
  }
  asset(value.catalogue, /^demo\/vessels-[a-f0-9]{12}\.json$/)
  let end = 0
  value.chunks.forEach((chunk, index) => {
    asset(chunk, new RegExp(`^demo/day-${String(index).padStart(2, '0')}-[a-f0-9]{12}\\.json$`))
    if (!object(chunk) || chunk.start !== end || !integer(chunk.end) || chunk.end <= end || !integer(chunk.segmentCount) || !integer(chunk.sampleCount)) throw new Error('Invalid chunk coverage.')
    end = chunk.end
  })
  if (end !== value.duration) throw new Error('Incomplete chunk coverage.')
  return value as unknown as TrackManifest
}
export function chunkAt(manifest: TrackManifest, time: number): number {
  if (!Number.isFinite(time) || time < 0 || time >= manifest.duration) throw new Error('Time outside chunk coverage.')
  return manifest.chunks.findIndex(chunk => time >= chunk.start && time < chunk.end)
}
export function parseCatalogue(value: unknown, manifest: TrackManifest): Vessel[] {
  if (!object(value) || value.kind !== 'vessel-catalogue' || value.schemaVersion !== 1 || value.studyId !== manifest.id || !sourceMatches(value.source, manifest.source)) throw new Error('Catalogue identity mismatch.')
  const study = parseStudy({ ...manifest, kind: 'tracks', vessels: value.vessels, segments: [] })
  if (study.vessels.length !== manifest.vesselCount) throw new Error('Catalogue count mismatch.')
  return study.vessels
}
export function parseChunk(value: unknown, manifest: TrackManifest, vessels: Vessel[], index: number): TrackStudy {
  if (!object(value) || value.schemaVersion !== 1 || value.kind !== 'track-chunk' || value.studyId !== manifest.id || value.index !== index || !sourceMatches(value.source, manifest.source) || !Array.isArray(value.segments)) throw new Error('Chunk identity mismatch.')
  const window = manifest.chunks[index]
  if (!window || value.segments.length !== window.segmentCount) throw new Error('Chunk segment count mismatch.')
  let count = 0
  const segments: TrackSegment[] = value.segments.map(row => {
    if (!Array.isArray(row) || row.length !== 5 || typeof row[0] !== 'string' || !integer(row[1]) || !vessels[row[1]] || (row[2] !== null && typeof row[2] !== 'string') || (row[3] !== null && typeof row[3] !== 'string') || !Array.isArray(row[4]) || row[4].length < 3 || row[4].length % 3) throw new Error('Invalid packed segment.')
    const samples = []
    for (let i = 0; i < row[4].length; i += 3) samples.push({ time: row[4][i], position: [row[4][i + 1], row[4][i + 2]] as const })
    count += samples.length
    if (samples[0].time >= window.end || samples[samples.length - 1].time < window.start) throw new Error('Segment outside chunk window.')
    return { id: row[0], vesselId: vessels[row[1]].id, ...(row[2] ? { originPortId: row[2] } : {}), ...(row[3] ? { destinationPortId: row[3] } : {}), samples }
  })
  if (count !== window.sampleCount) throw new Error('Chunk sample count mismatch.')
  // The same public evidence/coordinate/order/identity gate used for full tracks.
  return parseStudy({ ...manifest, kind: 'tracks', vessels, segments })
}
export type AssetReader = (asset: Asset, signal: AbortSignal) => Promise<unknown>
export function assetReader(resolve: (path: string) => string): AssetReader {
  return async (asset, signal) => {
    const response = await fetch(resolve(asset.path), { signal })
    if (!response.ok) throw new Error('Unable to load movement data.')
    const buffer = await response.arrayBuffer()
    if (buffer.byteLength !== asset.bytes) throw new Error('Asset byte count mismatch.')
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)), byte => byte.toString(16).padStart(2, '0')).join('')
    if (hash !== asset.sha256) throw new Error('Asset integrity mismatch.')
    signal.throwIfAborted()
    return JSON.parse(new TextDecoder().decode(buffer)) as unknown
  }
}
export interface ChunkStats { cachedChunks: number; decodedBytes: number; residentSamples: number; fetchedBytes: number; lastLoadMs: number }
/** At most current + next: foreground and prefetch share one request per asset. */
export class ChunkStore {
  private entries = new Map<number, { controller: AbortController; promise: Promise<TrackStudy>; study?: TrackStudy }>()
  private allowed = new Set<number>()
  private fetchedBytes = 0
  private lastLoadMs = 0
  constructor(readonly manifest: TrackManifest, readonly vessels: Vessel[], private read: AssetReader) {}
  retain(index: number) {
    this.allowed = new Set([index, (index + 1) % this.manifest.chunks.length])
    for (const [key, entry] of this.entries) if (!this.allowed.has(key)) { entry.controller.abort(); this.entries.delete(key) }
  }
  load(index: number): Promise<TrackStudy> {
    const found = this.entries.get(index)
    if (found) return found.promise
    if (!this.allowed.has(index)) return Promise.reject(new Error('Chunk is outside the retained window.'))
    const controller = new AbortController()
    const started = performance.now()
    const entry: { controller: AbortController; promise: Promise<TrackStudy>; study?: TrackStudy } = { controller, promise: Promise.resolve(null as unknown as TrackStudy) }
    entry.promise = this.read(this.manifest.chunks[index], controller.signal).then(value => {
      controller.signal.throwIfAborted()
      const study = parseChunk(value, this.manifest, this.vessels, index)
      controller.signal.throwIfAborted()
      entry.study = study
      this.fetchedBytes += this.manifest.chunks[index].bytes
      this.lastLoadMs = performance.now() - started
      return study
    }).catch(error => { if (this.entries.get(index) === entry) this.entries.delete(index); throw error })
    this.entries.set(index, entry)
    return entry.promise
  }
  peek(index: number) { return this.entries.get(index)?.study }
  stats(): ChunkStats {
    let cachedChunks = 0, decodedBytes = 0, residentSamples = 0
    for (const [index, entry] of this.entries) if (entry.study) { cachedChunks++; decodedBytes += this.manifest.chunks[index].bytes; residentSamples += this.manifest.chunks[index].sampleCount }
    return { cachedChunks, decodedBytes, residentSamples, fetchedBytes: this.fetchedBytes, lastLoadMs: this.lastLoadMs }
  }
  dispose() { for (const entry of this.entries.values()) entry.controller.abort(); this.entries.clear(); this.allowed.clear() }
}
