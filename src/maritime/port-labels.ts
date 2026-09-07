import catalogue from '../../public/data/ports.json'
import { projectionScale } from './map-projection'
import type { MapCamera } from './map-gestures'

export const ports = catalogue
const passages = [
  { id: 'hormuz', name: 'Strait of Hormuz', position: [56, 26.5] },
  { id: 'suez', name: 'Suez Canal', position: [32.5, 30] },
]
interface Box { x: number; y: number; width: number; height: number }
export interface PortLabel extends Box { id: string; name: string; markerX: number; markerY: number }
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width + 4 && a.x + a.width + 4 > b.x && a.y < b.y + b.height + 4 && a.y + a.height + 4 > b.y

/** Keep every visible port labelled, moving text around collisions instead of hiding it. */
export function layoutPortLabels(camera: MapCamera, viewport: { width: number; height: number }): PortLabel[] {
  const { width, height } = viewport
  if (width < 100 || height < 100) return []
  const scale = projectionScale(viewport) * camera.zoom
  const occupied: Box[] = [
    { x: 0, y: 0, width: Math.min(245, width * .62), height: 69 },
    { x: width - 190, y: 0, width: 190, height: 78 },
    { x: width - 90, y: height - 170, width: 90, height: 170 },
    { x: 0, y: height - 40, width: 270, height: 40 },
  ]
  const result: PortLabel[] = []
  for (const port of camera.zoom > 2 ? [...ports, ...passages] : ports) {
    const markerY = height / 2 - (port.position[1] - camera.latitude) * scale
    if (markerY < 0 || markerY > height) continue
    const copies = [-360, 0, 360].map(shift => width / 2 + (port.position[0] + shift - camera.longitude) * scale)
    const markerX = copies.filter(x => x >= 0 && x <= width).sort((a, b) => Math.abs(a - width / 2) - Math.abs(b - width / 2))[0]
    if (markerX === undefined) continue
    const boxWidth = port.name.length * 7.5 + 14
    const candidates: Box[] = []
    for (let row = 0; row < 10; row++) {
      for (const dy of [-30 - row * 26, 10 + row * 26]) for (const dx of [10, -boxWidth - 10]) {
        const candidate = { x: Math.max(6, Math.min(width - boxWidth - 6, markerX + dx)), y: Math.max(6, Math.min(height - 30, markerY + dy)), width: boxWidth, height: 24 }
        candidates.push(candidate)
      }
    }
    const box = candidates.find(candidate => occupied.every(other => !overlaps(candidate, other))) ?? candidates[0]
    occupied.push(box)
    result.push({ ...box, id: port.id, name: port.name, markerX, markerY })
  }
  return result
}
