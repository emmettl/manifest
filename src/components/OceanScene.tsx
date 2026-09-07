import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { attachMapGestures } from '../maritime/map-gestures'
import { DAY, positionAt } from '../maritime/playback'
import type { Region } from '../maritime/regions'
import type { LandCollection, Position, TrackStudy, VesselClass } from '../maritime/types'

const colors = { cargo: '#d5e9e7', tanker: '#e9b86b', other: '#70888e' }
const ports: { position: Position; label: string }[] = [
  { position: [122,31], label: 'SHANGHAI' }, { position: [114,22], label: 'PEARL RIVER' },
  { position: [56,26.5], label: 'HORMUZ' }, { position: [104,1], label: 'SINGAPORE' },
  { position: [32.5,30], label: 'SUEZ' }, { position: [4,52], label: 'ROTTERDAM' },
]

interface Props { study: TrackStudy; land: LandCollection; time: number; region: Region; visible: Set<VesselClass>; selected: string | null; onSelect: (id: string | null) => void }

export function OceanScene({ study, land, time, region, visible, selected, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const backdrop = useRef<HTMLCanvasElement | null>(null)
  const hits = useRef<{ id: string; x: number; y: number }[]>([])
  const [size, setSize] = useState({ width: 1, height: 1 })
  const [camera, setCamera] = useState({ longitude: region.center[0] as number, latitude: region.center[1] as number, zoom: region.zoom as number })
  const cameraRef = useRef(camera)
  useLayoutEffect(() => { cameraRef.current = camera }, [camera])
  useEffect(() => attachMapGestures(canvasRef.current!, () => cameraRef.current, next => {
    cameraRef.current = next
    setCamera(next)
  }, ({ x, y }) => {
    const hit = hits.current.filter(item => Math.hypot(item.x - x, item.y - y) < 18).sort((a,b) => Math.hypot(a.x - x,a.y-y) - Math.hypot(b.x-x,b.y-y))[0]
    onSelect(hit?.id ?? null)
  }), [region, onSelect])
  useEffect(() => { setCamera({ longitude: region.center[0], latitude: region.center[1], zoom: region.zoom }) }, [region])
  useEffect(() => {
    const canvas = canvasRef.current!
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])
  const scale = Math.min(size.width / 360, size.height / 150) * .9 * camera.zoom
  const worldWidth = scale * 360
  const project = ([longitude, latitude]: Position): Position => [size.width / 2 + (longitude - camera.longitude) * scale, size.height / 2 - (latitude - camera.latitude) * scale]

  useEffect(() => {
    const buffer = document.createElement('canvas')
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    buffer.width = Math.round(size.width * ratio); buffer.height = Math.round(size.height * ratio)
    const context = buffer.getContext('2d')!
    context.scale(ratio, ratio)
    context.fillStyle = '#080f14'; context.fillRect(0, 0, size.width, size.height)
    context.strokeStyle = '#14232b'; context.lineWidth = .65
    for (let longitude = -540; longitude <= 540; longitude += 30) {
      const [x] = project([longitude, 0]); context.beginPath(); context.moveTo(x, 0); context.lineTo(x, size.height); context.stroke()
    }
    for (let latitude = -90; latitude <= 90; latitude += 30) {
      const [,y] = project([0, latitude]); context.beginPath(); context.moveTo(0, y); context.lineTo(size.width, y); context.stroke()
      if (y > 30 && y < size.height - 30) { context.font = '10px monospace'; context.fillStyle = '#4b6470'; context.fillText(`${Math.abs(latitude)}°${latitude < 0 ? 'S' : latitude > 0 ? 'N' : ''}`, 15, y - 7) }
    }
    context.fillStyle = '#142329'; context.strokeStyle = '#30464b'; context.lineWidth = .7
    for (const feature of land.features) {
      const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates as number[][][]] : feature.geometry.coordinates as number[][][][]
      for (const polygon of polygons) for (const shift of [-360, 0, 360]) {
        context.beginPath()
        for (const ring of polygon) {
          let previous = ring[0][0]
          ring.forEach((point, index) => {
            let longitude = point[0]
            while (longitude - previous > 180) longitude -= 360
            while (longitude - previous < -180) longitude += 360
            previous = longitude
            const [x,y] = project([longitude + shift, point[1]])
            if (index === 0) context.moveTo(x, y); else context.lineTo(x, y)
          })
          context.closePath()
        }
        context.fill('evenodd'); context.stroke()
      }
    }
    const oceanLabels: [string, Position][] = [['PACIFIC OCEAN', [-145, 0]], ['ATLANTIC OCEAN', [-35, 8]], ['INDIAN OCEAN', [77, -22]]]
    if (camera.zoom < 2) {
      context.font = '11px monospace'; context.fillStyle = '#4b6571'; context.textAlign = 'center'
      for (const [label, point] of oceanLabels) for (const shift of [-360,0,360]) { const [x,y] = project([point[0] + shift, point[1]]); context.fillText(label, x, y) }
    }
    for (const port of ports) for (const shift of [-360, 0, 360]) {
      const [x,y] = project([port.position[0] + shift, port.position[1]])
      context.fillStyle = '#71898c'; context.fillRect(x - 2, y - 2, 4, 4)
      if (camera.zoom > 2) { context.font = '11px monospace'; context.textAlign = 'left'; context.fillText(port.label, x + 8, y - 8) }
    }
    backdrop.current = buffer
  // The projection is determined entirely by these camera and size values.
  }, [land, camera, size])

  useEffect(() => {
    const canvas = canvasRef.current!
    const context = canvas.getContext('2d')!
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(size.width * ratio); canvas.height = Math.round(size.height * ratio)
    if (backdrop.current) context.drawImage(backdrop.current, 0, 0)
    context.scale(ratio, ratio)
    const vessels = new Map(study.vessels.map(vessel => [vessel.id, vessel]))
    hits.current = []
    for (const segment of study.segments) {
      const vessel = vessels.get(segment.vesselId)!
      if (!visible.has(vessel.category)) continue
      const point = positionAt(segment, time)
      if (!point) continue
      const active = selected === vessel.id
      const faded = selected && !active
      context.strokeStyle = colors[vessel.category]; context.fillStyle = colors[vessel.category]
      for (const shift of [-360, 0, 360]) {
        const [x, y] = project([point[0] + shift, point[1]])
        if (x < -100 || x > size.width + 100 || y < -100 || y > size.height + 100) continue
        let previous: Position | null = null
        for (let i = 0; i <= 24; i++) {
          const trailPoint = positionAt(segment, time - (1 - i / 24) * DAY * (active ? 3 : 1.4))
          if (!trailPoint) { previous = null; continue }
          const projected = project([trailPoint[0] + shift, trailPoint[1]])
          if (previous && Math.abs(projected[0] - previous[0]) < worldWidth / 2) {
            context.globalAlpha = (i / 24) * (faded ? .08 : active ? .85 : .45)
            context.lineWidth = active ? 1.7 : .9
            context.beginPath(); context.moveTo(previous[0], previous[1]); context.lineTo(projected[0], projected[1]); context.stroke()
          }
          previous = projected
        }
        context.globalAlpha = faded ? .18 : .95
        context.beginPath(); context.arc(x, y, active ? 3.6 : 1.7, 0, Math.PI * 2); context.fill()
        if (active) {
          context.globalAlpha = .4; context.beginPath(); context.arc(x,y,9,0,Math.PI * 2); context.stroke()
          context.globalAlpha = 1; context.font = '12px monospace'; context.fillText(vessel.label.toUpperCase(), x + 15, y - 10)
        }
        hits.current.push({ id: vessel.id, x, y })
      }
    }
    context.globalAlpha = 1
  }, [study, time, visible, selected, camera, size])

  return <div className="ocean-scene">
    <canvas ref={canvasRef} aria-label="World map with synthetic cargo and tanker movement. Use the region controls and vessel selector to explore with a keyboard." role="img"
      />
    <div className="map-tools" aria-label="Map controls">
      <button aria-label="Zoom in" data-tooltip="See the vessels more closely" disabled={camera.zoom >= 10} onClick={() => setCamera(current => ({ ...current, zoom: Math.min(10, current.zoom * 1.4) }))}>+</button>
      <button aria-label="Zoom out" data-tooltip="See more of the ocean" disabled={camera.zoom <= 1} onClick={() => setCamera(current => ({ ...current, zoom: Math.max(1, current.zoom / 1.4) }))}>−</button>
      <button aria-label="Reset map view" data-tooltip="Return to this chapter’s opening view" onClick={() => setCamera({ longitude: region.center[0], latitude: region.center[1], zoom: region.zoom })}>↺</button>
    </div>
    <span className="map-hint">Drag to explore · Pinch to zoom</span>
  </div>
}
