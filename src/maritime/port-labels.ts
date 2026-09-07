import catalogue from '../../public/data/ports.json'
import { projectionScale } from './map-projection'
import type { MapCamera } from './map-gestures'

export interface Port {
  id: string; name: string; position: number[]; aliases: string[]
  demoEndpoint: boolean; selection: string; containerRank2024?: number
}
export const ports: Port[] = catalogue
const passages = [
  { id: 'hormuz', name: 'Strait of Hormuz', position: [56, 26.5] },
  { id: 'suez', name: 'Suez Canal', position: [32.5, 30] },
]
interface Box { x: number; y: number; width: number; height: number }
export interface PortLabel extends Box { id: string; name: string; markerX: number; markerY: number; labelled: boolean }
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width + 4 && a.x + a.width + 4 > b.x && a.y < b.y + b.height + 4 && a.y + a.height + 4 > b.y

export function searchPorts(query: string): Port[] {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  const term = normalize(query)
  const words = term.split(/\s+/).filter(Boolean)
  const score = (port: Port) => normalize(port.name) === term ? 0 : normalize(port.name).startsWith(term) ? 1 : 2
  return ports.filter(port => {
    const text = normalize([port.name, ...port.aliases].join(' '))
    return words.every(word => text.includes(word))
  }).sort((a, b) => (term ? score(a) - score(b) : (a.containerRank2024 ?? 100) - (b.containerRank2024 ?? 100)) || a.name.localeCompare(b.name))
}

/** Preserve every visible marker; reveal names where they fit, prioritising the selected port and voyage endpoints. */
export function layoutPortLabels(camera: MapCamera, viewport: { width: number; height: number }, selectedId?: string): PortLabel[] {
  const { width, height } = viewport
  if (width < 100 || height < 100) return []
  const scale = projectionScale(viewport) * camera.zoom
  const occupied: Box[] = [
    { x: 0, y: 0, width: Math.min(370, width - 12), height: 130 },
    { x: width - 190, y: 0, width: 190, height: 78 },
    { x: width - 90, y: height - 170, width: 90, height: 170 },
    { x: 0, y: height - 40, width: 270, height: 40 },
  ]
  const result: PortLabel[] = []
  const ordered = [...ports].sort((a, b) => Number(b.id === selectedId) - Number(a.id === selectedId) || Number(b.demoEndpoint) - Number(a.demoEndpoint) || (a.containerRank2024 ?? 100) - (b.containerRank2024 ?? 100))
  const projected = (camera.zoom > 2 ? [...ordered, ...passages] : ordered).flatMap(port => {
    const markerY = height / 2 - (port.position[1] - camera.latitude) * scale
    if (markerY < 0 || markerY > height) return []
    const copies = [-360, 0, 360].map(shift => width / 2 + (port.position[0] + shift - camera.longitude) * scale)
    const markerX = copies.filter(x => x >= 0 && x <= width).sort((a, b) => Math.abs(a - width / 2) - Math.abs(b - width / 2))[0]
    return markerX === undefined ? [] : [{ port, markerX, markerY }]
  })
  // A neighbouring marker must not punch through another port's text.
  occupied.push(...projected.map(({ markerX, markerY }) => ({ x: markerX - 3, y: markerY - 3, width: 6, height: 6 })))
  for (const { port, markerX, markerY } of projected) {
    const boxWidth = Math.min(width - 12, port.name.length * 7.5 + 14)
    const candidates: Box[] = []
    const priority = port.id === selectedId || ('demoEndpoint' in port && port.demoEndpoint)
    for (let row = 0; row < (priority ? 10 : 2); row++) {
      for (const dy of [-30 - row * 26, 10 + row * 26]) for (const dx of [10, -boxWidth - 10]) {
        const candidate = { x: Math.max(6, Math.min(width - boxWidth - 6, markerX + dx)), y: Math.max(6, Math.min(height - 30, markerY + dy)), width: boxWidth, height: 24 }
        candidates.push(candidate)
      }
    }
    const box = candidates.find(candidate => occupied.every(other => !overlaps(candidate, other)))
    if (box) occupied.push(box)
    result.push({ ...(box ?? candidates[0]), id: port.id, name: port.name, markerX, markerY, labelled: !!box })
  }
  return result
}
