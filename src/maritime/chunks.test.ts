import { parseStudy } from './load'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDemoStudy } from '../../scripts/generate-demo.mjs'
import { encodeSegments, sliceTrackWindow } from '../../scripts/chunk-tracks.mjs'
import { positionAt } from './playback'
import { assetReader, chunkAt, ChunkStore, parseCatalogue, parseChunk, parseManifest, type TrackManifest } from './chunks'
import type { TrackStudy } from './types'
const read = (path: string) => JSON.parse(readFileSync(`public/data/${path}`, 'utf8'))
const manifest = parseManifest(read('demo-study.json'))
const catalogue = parseCatalogue(read(manifest.catalogue.path), manifest)

afterEach(() => vi.unstubAllGlobals())

it('delivers the same ships and full selected wakes across daily seams and the dateline', () => {
  const original = parseStudy(createDemoStudy())
  const byId = new Map(original.segments.map(segment => [segment.id, segment]))
  // Both sides of seams, the opening, and the last legal study instant.
  for (const time of [0, 86400 - .01, 86400, 10.5 * 86400, 11 * 86400 - .01, 11 * 86400, manifest.duration - 1]) {
    const index = chunkAt(manifest, time)
    const study = parseChunk(read(manifest.chunks[index].path), manifest, catalogue, index)
    const expected = original.segments.filter(segment => positionAt(segment, time)).map(segment => segment.id)
    expect(study.segments.filter(segment => positionAt(segment, time)).map(segment => segment.id)).toEqual(expected)
    // Every active ship retains exact interpolation at every one of the 25 wake
    // lookup times, including a sample beyond the delivery window when needed.
    for (const segment of study.segments) if (positionAt(segment, time)) {
      const reference = byId.get(segment.id)!
      for (let i = 0; i <= 24; i++) {
        const at = time - i / 24 * manifest.lookbackSeconds
        const a = positionAt(segment, at), b = positionAt(reference, at)
        if (a === null || b === null) { if (a !== b) throw new Error(`Missing wake: ${segment.id} at ${at}`) }
        else if (Math.abs(a[0] - b[0]) > 1e-10 || Math.abs(a[1] - b[1]) > 1e-10) throw new Error(`Changed wake: ${segment.id} at ${at}`)
      }
    }
  }
}, 20_000)

it('keeps a true reception gap distinct from a delivery seam', () => {
  const study: TrackStudy = { schemaVersion: 1, kind: 'tracks', id: 'gaps', title: 'Test', startUtc: '2026-01-01', duration: 100, source: manifest.source, vessels: [catalogue[0]], segments: [
    { id: 'before', vesselId: catalogue[0].id, samples: [{ time: 0, position: [179, 1] }, { time: 20, position: [-179, 1] }] },
    { id: 'after', vesselId: catalogue[0].id, samples: [{ time: 60, position: [-178, 1] }, { time: 100, position: [-177, 1] }] },
  ] }
  const sliced: TrackStudy['segments'] = sliceTrackWindow(study, 10, 90)
  expect(sliced.map(segment => segment.id)).toEqual(['before', 'after'])
  expect(sliced.every(segment => positionAt(segment, 40) === null)).toBe(true)
  expect(positionAt(sliced[0], 10)).toEqual([-180, 1])
  expect(encodeSegments(sliced, new Map([[catalogue[0].id, 0]]))).toHaveLength(2)
})

it('rejects unapproved sources, incomplete coverage, foreign paths, and mismatched chunks', () => {
  expect(() => parseManifest({ ...manifest, source: { ...manifest.source, evidence: 'observed' } })).toThrow('synthetic')
  expect(() => parseManifest({ ...manifest, chunks: manifest.chunks.slice(1) })).toThrow()
  expect(() => parseManifest({ ...manifest, catalogue: { ...manifest.catalogue, path: '../raw.json' } })).toThrow('asset')
  expect(() => parseManifest({ ...manifest, catalogue: { ...manifest.catalogue, path: 'https://example.com/data.json' } })).toThrow('asset')
  expect(() => parseManifest({ ...manifest, catalogue: { ...manifest.catalogue, bytes: 9 * 1024 * 1024 } })).toThrow('asset')
  const chunk = read(manifest.chunks[0].path)
  expect(() => parseChunk(chunk, manifest, catalogue, 1)).toThrow('identity')
  expect(() => parseChunk({ ...chunk, source: { ...manifest.source, evidence: 'observed' } }, manifest, catalogue, 0)).toThrow('identity')
  expect(() => parseCatalogue({ ...read(manifest.catalogue.path), studyId: 'other' }, manifest)).toThrow('identity')
  chunk.segments[0][4][0] = 'invalid-time'
  expect(() => parseChunk(chunk, manifest, catalogue, 0)).toThrow('sample')
})

it('verifies response bytes and SHA-256 before admitting a downloaded asset', async () => {
  const text = '{"test":true}'
  const asset = { path: 'test.json', bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex') }
  vi.stubGlobal('fetch', vi.fn(async () => new Response(text)))
  const reader = assetReader(path => `/data/${path}`)
  expect(await reader(asset, new AbortController().signal)).toEqual({ test: true })
  await expect(reader({ ...asset, bytes: 1 }, new AbortController().signal)).rejects.toThrow('byte count')
  await expect(reader({ ...asset, sha256: '0'.repeat(64) }, new AbortController().signal)).rejects.toThrow('integrity')
})

function tiny() {
  const manifest: TrackManifest = { ...parseManifest(read('demo-study.json')), duration: 40, vesselCount: 1, sampleCount: 8, chunks: Array.from({ length: 4 }, (_, index) => ({ path: String(index), bytes: 100, sha256: '', start: index * 10, end: (index + 1) * 10, segmentCount: 1, sampleCount: 2 })) }
  const packet = (index: number) => ({ schemaVersion: 1, kind: 'track-chunk', studyId: manifest.id, source: manifest.source, index, segments: [[`segment-${index}`, 0, null, null, [index * 10, 179, 0, (index + 1) * 10, -179, 1]]] })
  return { manifest, packet }
}
describe('bounded chunk cache', () => {
  it('reuses prefetched requests and evicts old days', async () => {
    const { manifest, packet } = tiny()
    const reader = vi.fn(async (asset: { path: string }) => packet(Number(asset.path)))
    const store = new ChunkStore(manifest, [catalogue[0]], reader)
    store.retain(0)
    await store.load(0)
    const ahead = store.load(1)
    store.retain(1)
    expect(store.load(1)).toBe(ahead)
    await ahead
    await store.load(2)
    expect(reader).toHaveBeenCalledTimes(3)
    expect(store.stats().cachedChunks).toBe(2)
    expect(store.stats().decodedBytes).toBe(200)
    store.retain(2)
    await store.load(3)
    expect(store.stats().cachedChunks).toBe(2)
    store.dispose()
    expect(store.stats().cachedChunks).toBe(0)
  })
  it('discards obsolete results even when the transport ignores cancellation', async () => {
    const { manifest, packet } = tiny()
    let finish!: (value: unknown) => void
    const reader = vi.fn(() => new Promise(resolve => { finish = resolve }))
    const store = new ChunkStore(manifest, [catalogue[0]], reader)
    store.retain(0)
    const stale = store.load(0)
    store.retain(2)
    finish(packet(0))
    await expect(stale).rejects.toThrow()
    expect(store.stats().cachedChunks).toBe(0)
    store.dispose()
  })
  it('retries failed foreground or prefetch requests without retaining errors', async () => {
    const { manifest, packet } = tiny()
    const reader = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(packet(0))
    const store = new ChunkStore(manifest, [catalogue[0]], reader)
    store.retain(0)
    await expect(store.load(0)).rejects.toThrow('offline')
    expect(store.stats().cachedChunks).toBe(0)
    await store.load(0)
    expect(reader).toHaveBeenCalledTimes(2)
    expect(store.stats().cachedChunks).toBe(1)
    store.dispose()
  })
})
