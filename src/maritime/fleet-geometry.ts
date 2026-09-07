import { positionAt, wrapLongitude } from './playback'
import { projectionScale } from './map-projection'
import type { TrackStudy, VesselClass } from './types'

export interface FleetView {
  time: number
  camera: { longitude: number; latitude: number; zoom: number }
  size: { width: number; height: number }
  visible: Set<VesselClass>
  selected: string | null
}

export const HEAD_TEXTURE_WIDTH = 256
export const EDGE_FLOATS = 7

/** Immutable original-sample edges. Never join segments; split at the map seam. */
export function packFleetEdges(study: TrackStudy): Float32Array {
  const edges: number[] = []
  study.segments.forEach((segment, index) => {
    for (let i = 1; i < segment.samples.length; i++) {
      const a = segment.samples[i - 1], b = segment.samples[i]
      const end = a.position[0] + wrapLongitude(b.position[0] - a.position[0])
      if (end > 180 || end < -180) {
        const seam = end > 180 ? 180 : -180
        const fraction = (seam - a.position[0]) / (end - a.position[0])
        const latitude = a.position[1] + (b.position[1] - a.position[1]) * fraction
        const time = a.time + (b.time - a.time) * fraction
        if (time > a.time) edges.push(a.position[0], a.position[1], a.time, seam, latitude, time, index)
        if (b.time > time) edges.push(-seam, latitude, time, end - 2 * seam, b.position[1], b.time, index)
      } else {
        edges.push(a.position[0], a.position[1], a.time, end, b.position[1], b.time, index)
      }
    }
  })
  return new Float32Array(edges)
}

/** One reusable texture row per logical segment: longitude, latitude, class, selected. */
export class FleetHeads {
  readonly data: Float32Array
  readonly categories: VesselClass[]
  private packedEdges: Float32Array | null = null
  get edges(): Float32Array { return this.packedEdges ??= packFleetEdges(this.study) }
  constructor(readonly study: TrackStudy) {
    this.data = new Float32Array(HEAD_TEXTURE_WIDTH * Math.max(1, Math.ceil(study.segments.length / HEAD_TEXTURE_WIDTH)) * 4)
    const categories = new Map(study.vessels.map(vessel => [vessel.id, vessel.category]))
    this.categories = study.segments.map(segment => categories.get(segment.vesselId)!)
  }
  update(view: FleetView): number {
    const { camera, size, time, visible, selected } = view
    const scale = projectionScale(size) * camera.zoom
    let drawn = 0
    for (let i = 0; i < this.study.segments.length; i++) {
      const offset = i * 4, segment = this.study.segments[i], category = this.categories[i]
      const point = visible.has(category) ? positionAt(segment, time) : null
      this.data[offset + 2] = 0
      if (!point) continue
      this.data[offset] = point[0]; this.data[offset + 1] = point[1]
      this.data[offset + 2] = category === 'cargo' ? 1 : category === 'tanker' ? 2 : 3
      this.data[offset + 3] = Number(selected === segment.vesselId)
      const y = size.height / 2 - (point[1] - camera.latitude) * scale
      if (y < -100 || y > size.height + 100) continue
      for (let shift = -360; shift <= 360; shift += 360) {
        const x = size.width / 2 + (point[0] + shift - camera.longitude) * scale
        if (x >= -100 && x <= size.width + 100) drawn++
      }
    }
    return drawn
  }
  /** Picking is demand-driven; no per-frame array of hit objects. */
  pick(view: FleetView, x: number, y: number): string | null {
    this.update(view)
    const scale = projectionScale(view.size) * view.camera.zoom
    let nearest = 18 * 18, id: string | null = null
    for (let i = 0; i < this.study.segments.length; i++) {
      const offset = i * 4
      if (!this.data[offset + 2]) continue
      const dy = view.size.height / 2 - (this.data[offset + 1] - view.camera.latitude) * scale - y
      if (Math.abs(dy) >= 18) continue
      for (let shift = -360; shift <= 360; shift += 360) {
        const dx = view.size.width / 2 + (this.data[offset] + shift - view.camera.longitude) * scale - x
        const distance = dx * dx + dy * dy
        if (distance < nearest) { nearest = distance; id = this.study.segments[i].vesselId }
      }
    }
    return id
  }
}
