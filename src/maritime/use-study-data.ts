import { useEffect, useMemo, useState } from 'react'
import { parseLand, parseStudy } from './load'
import { assetReader, chunkAt, ChunkStore, parseCatalogue, parseManifest, type ChunkStats, type TrackManifest } from './chunks'
import type { LandCollection, TrackStudy } from './types'

export function useStudyData(time: number, playing: boolean, localReview: boolean, resolve: (path: string) => string) {
  const [attempt, setAttempt] = useState(0)
  const [chunkAttempt, setChunkAttempt] = useState(0)
  const [base, setBase] = useState<{ store: ChunkStore; land: LandCollection } | null>(null)
  const [data, setData] = useState<{ study: TrackStudy; land: LandCollection } | null>(null)
  const [initialError, setInitialError] = useState(false)
  const [chunkError, setChunkError] = useState(false)
  const [loadedIndex, setLoadedIndex] = useState(-1)
  const [stats, setStats] = useState<ChunkStats | null>(null)
  const manifest: TrackManifest | null = base?.store.manifest ?? null
  const index = manifest ? chunkAt(manifest, time) : -1
  const cached = base?.store.peek(index)
  const presented = useMemo(() => cached && base ? { study: cached, land: base.land } : data, [cached, base, data])
  const ready = !!presented && (localReview || !!cached || loadedIndex === index)

  useEffect(() => {
    const controller = new AbortController()
    let store: ChunkStore | undefined
    setBase(null); setData(null); setLoadedIndex(-1); setStats(null); setInitialError(false); setChunkError(false)
    const read = async (file: string) => {
      const response = await fetch(import.meta.env.DEV && file.startsWith('/__local/') ? file : resolve(file), { signal: controller.signal })
      if (!response.ok) throw new Error('Unable to load study.')
      return response.json() as Promise<unknown>
    }
    const load = async () => {
      if (import.meta.env.DEV && localReview) {
        const [study, land] = await Promise.all([read('/__local/noaa-la-2025.json'), read('/__local/noaa-la-land.geojson')])
        controller.signal.throwIfAborted()
        setData({ study: parseStudy(study, 'noaa-la-2025'), land: parseLand(land) })
      } else {
        const [rawManifest, land] = await Promise.all([read('demo-study.json'), read('land.geojson')])
        const manifest = parseManifest(rawManifest)
        const reader = assetReader(resolve)
        const vessels = parseCatalogue(await reader(manifest.catalogue, controller.signal), manifest)
        controller.signal.throwIfAborted()
        store = new ChunkStore(manifest, vessels, reader)
        setBase({ store, land: parseLand(land) })
      }
    }
    void load().catch(() => { if (!controller.signal.aborted) setInitialError(true) })
    return () => { controller.abort(); store?.dispose() }
  }, [attempt, localReview, resolve])

  useEffect(() => {
    if (!base) return
    let obsolete = false
    setChunkError(false)
    base.store.retain(index)
    void base.store.load(index).then(study => {
      if (obsolete) return
      setData({ study, land: base.land }); setLoadedIndex(index); setStats(base.store.stats())
    }).catch(() => { if (!obsolete) setChunkError(true) })
    return () => { obsolete = true }
  }, [base, index, chunkAttempt])

  useEffect(() => {
    if (!base || !playing || loadedIndex !== index) return
    let obsolete = false
    const next = (index + 1) % base.store.manifest.chunks.length
    void base.store.load(next).then(() => { if (!obsolete) setStats(base.store.stats()) }).catch(() => {
      // An optional prefetch failure is retried as a foreground request on entry.
    })
    return () => { obsolete = true }
  }, [base, playing, loadedIndex, index])

  return { data: presented, manifest, ready, error: initialError || chunkError, stats, index,
    retry: () => base ? setChunkAttempt(value => value + 1) : setAttempt(value => value + 1) }
}
