import { DAY } from './playback'
import { projectionScale } from './map-projection'
import { EDGE_FLOATS, type FleetHeads, type FleetView } from './fleet-geometry'

const colors = ['#d5e9e7', '#e9b86b', '#70888e']
const FADE_STEPS = 16

/** Batched fallback: bounded strokes, original sample edges and full wake durations. */
export function drawCanvasFleet(context: CanvasRenderingContext2D, heads: FleetHeads, view: FleetView): number {
  const drawn = heads.update(view), edges = heads.edges, state = heads.data
  const scale = projectionScale(view.size) * view.camera.zoom
  const centerX = view.size.width / 2 - view.camera.longitude * scale
  const centerY = view.size.height / 2 + view.camera.latitude * scale
  const paths: (Path2D | undefined)[] = new Array(3 * 3 * FADE_STEPS)
  const points: (Path2D | undefined)[] = new Array(3 * 3)
  const observed = heads.study.source.evidence === 'observed'
  const inView = (x: number, y: number) => x >= -100 && x <= view.size.width + 100 && y >= -100 && y <= view.size.height + 100
  for (let offset = 0; offset < edges.length; offset += EDGE_FLOATS) {
    const index = edges[offset + 6] * 4, category = state[index + 2]
    if (!category) continue
    const active = state[index + 3] > .5
    const duration = observed ? active ? 3600 : 1800 : DAY * (active ? 3 : 1.4)
    const first = Math.max(edges[offset + 2], view.time - duration), last = Math.min(edges[offset + 5], view.time)
    if (last <= first) continue
    const span = edges[offset + 5] - edges[offset + 2]
    const startFraction = (first - edges[offset + 2]) / span, endFraction = (last - edges[offset + 2]) / span
    const dx = edges[offset + 3] - edges[offset], dy = edges[offset + 4] - edges[offset + 1]
    const ax = centerX + (edges[offset] + dx * startFraction) * scale
    const ay = centerY - (edges[offset + 1] + dy * startFraction) * scale
    const bx = centerX + (edges[offset] + dx * endFraction) * scale
    const by = centerY - (edges[offset + 1] + dy * endFraction) * scale
    const style = active ? 2 : view.selected ? 1 : 0
    const fade = Math.min(FADE_STEPS - 1, Math.floor(((first + last) / 2 - view.time + duration) / duration * FADE_STEPS))
    const key = ((category - 1) * 3 + style) * FADE_STEPS + fade
    for (let shift = -360; shift <= 360; shift += 360) {
      if (!inView(centerX + (state[index] + shift) * scale, centerY - state[index + 1] * scale)) continue
      const path = paths[key] ??= new Path2D()
      path.moveTo(ax + shift * scale, ay); path.lineTo(bx + shift * scale, by)
    }
  }
  for (let key = 0; key < paths.length; key++) {
    const path = paths[key]
    if (!path) continue
    const style = Math.floor(key / FADE_STEPS) % 3
    context.strokeStyle = colors[Math.floor(key / FADE_STEPS / 3)]
    context.globalAlpha = ((key % FADE_STEPS + .5) / FADE_STEPS) * (style === 2 ? .85 : style === 1 ? .08 : .45)
    context.lineWidth = style === 2 ? 1.7 : .9
    context.stroke(path)
  }
  for (let i = 0; i < heads.study.segments.length; i++) {
    const offset = i * 4, category = state[offset + 2]
    if (!category) continue
    const active = state[offset + 3] > .5, style = active ? 2 : view.selected ? 1 : 0
    const y = centerY - state[offset + 1] * scale
    for (let shift = -360; shift <= 360; shift += 360) {
      const x = centerX + (state[offset] + shift) * scale
      if (!inView(x, y)) continue
      const path = points[(category - 1) * 3 + style] ??= new Path2D()
      path.moveTo(x + (active ? 3.6 : 1.7), y); path.arc(x, y, active ? 3.6 : 1.7, 0, Math.PI * 2)
      if (active) {
        context.strokeStyle = colors[category - 1]; context.globalAlpha = .4; context.lineWidth = 1.7
        context.beginPath(); context.arc(x, y, 9, 0, Math.PI * 2); context.stroke()
      }
    }
  }
  for (let key = 0; key < points.length; key++) {
    if (!points[key]) continue
    context.fillStyle = colors[Math.floor(key / 3)]; context.globalAlpha = key % 3 === 1 ? .18 : .95
    context.fill(points[key]!)
  }
  context.globalAlpha = 1
  return drawn
}
