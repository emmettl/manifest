import { describe, expect, it } from 'vitest'
import { parseStudy } from './load'
import { PointerGesture, transformCamera } from './map-gestures'

const source = { id: 'noaa-la-2025', label: 'Invented NOAA-contract test fixture', evidence: 'observed', publication: 'review-required', license: 'test-only' }
const fixture = () => ({ schemaVersion: 1, kind: 'tracks', id: 'test', title: 'Test', startUtc: '2025-01-01T00:00:00Z', duration: 1000, source, vessels: [{ id: 'v', label: 'Test', category: 'cargo', evidence: 'observed' }], segments: [{ id: 's', vesselId: 'v', samples: [{ time: 0, position: [-118, 33] }, { time: 600, position: [-118.01, 33] }] }] })

describe('local review admission', () => {
  it('requires the explicit review path and pinned source; publication stays unapproved', () => {
    expect(() => parseStudy(fixture())).toThrow('synthetic')
    expect(parseStudy(fixture(), 'noaa-la-2025').source.publication).toBe('review-required')
    expect(() => parseStudy({ ...fixture(), source: { ...source, id: 'other-provider' } }, 'noaa-la-2025')).toThrow()
    expect(() => parseStudy({ ...fixture(), source: { ...source, publication: 'approved' } }, 'noaa-la-2025')).toThrow()
  })
  it('rejects mixed evidence and observed samples beyond the declared interval', () => {
    const mixed = fixture(); mixed.vessels[0].evidence = 'synthetic'
    expect(() => parseStudy(mixed, 'noaa-la-2025')).toThrow('vessel')
    const late = fixture(); late.segments[0].samples[1].time = 1001
    expect(() => parseStudy(late, 'noaa-la-2025')).toThrow('interval')
  })
})

describe('regional camera gestures', () => {
  it('pans at harbour scale without snapping to the world zoom cap', () => {
    const viewport = { width: 1200, height: 600 }, camera = { longitude: -118.2, latitude: 33.7, zoom: 240 }
    const center = { x: 600, y: 300 }
    expect(transformCamera(camera, center, center, 2, viewport, 320).zoom).toBe(320)
    const gesture = new PointerGesture(320)
    gesture.down(1, center, camera)
    const moved = gesture.move(1, { x: 650, y: 300 }, viewport)!
    expect(moved.zoom).toBe(240)
    expect(moved.longitude).toBeLessThan(camera.longitude)
    expect(moved.latitude).toBe(camera.latitude)
  })
})
