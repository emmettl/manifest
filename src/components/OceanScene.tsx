import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { PortLabels } from './PortLabels'
import { layoutPortLabels, ports, type Port } from '../maritime/port-labels'
import { projectionScale } from '../maritime/map-projection'
import { attachMapGestures } from '../maritime/map-gestures'
import { positionAt } from '../maritime/playback'
import { drawCanvasFleet } from '../maritime/fleet-canvas'
import { FleetHeads } from '../maritime/fleet-geometry'
import { createFleetRenderer, type FleetRenderer } from '../maritime/fleet-webgl'
import type { Region } from '../maritime/regions'
import type { LandCollection, Position, TrackStudy, VesselClass } from '../maritime/types'

const colors = { cargo: '#d5e9e7', tanker: '#e9b86b', other: '#70888e' }


interface Props { study: TrackStudy; land: LandCollection; time: number; playing: boolean; region: Region; visible: Set<VesselClass>; selected: string | null; onSelect: (id: string | null) => void; selectedPort: Port | null; onPortSelect: (port: Port | null) => void }

export function OceanScene({ study, land, time, playing, region, visible, selected, onSelect, selectedPort, onPortSelect }: Props) {
  const observed = study.source.evidence === 'observed'
  const maxZoom = observed ? 320 : 10
  const vessels = useMemo(() => new Map(study.vessels.map(vessel => [vessel.id, vessel])), [study])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const backdrop = useRef<HTMLCanvasElement | null>(null)
  const fleetCanvasRef = useRef<HTMLCanvasElement>(null)
  const [gpu, setGpu] = useState<FleetRenderer | null>(null)
  const heads = useMemo(() => new FleetHeads(study), [study])
  const frameRef = useRef({ time, visible, selected, heads })
  useLayoutEffect(() => { frameRef.current = { time, visible, selected, heads } }, [time, visible, selected, heads])
  useEffect(() => {
    const canvas = fleetCanvasRef.current!
    let renderer: FleetRenderer | null = null
    const initialize = () => {
      try { renderer = createFleetRenderer(canvas) }
      catch (error) { console.warn('Fleet WebGL unavailable; using Canvas fallback.', error); renderer = null }
      canvas.style.visibility = renderer ? 'visible' : 'hidden'
      setGpu(renderer)
    }
    const lost = (event: Event) => {
      event.preventDefault(); renderer?.dispose(); renderer = null
      canvas.style.visibility = 'hidden'; setGpu(null)
    }
    canvas.addEventListener('webglcontextlost', lost)
    canvas.addEventListener('webglcontextrestored', initialize)
    initialize()
    return () => {
      canvas.removeEventListener('webglcontextlost', lost)
      canvas.removeEventListener('webglcontextrestored', initialize)
      renderer?.dispose()
    }
  }, [])
  const performanceRef = useRef<HTMLOutputElement>(null)
  const measurements = useRef({ since: 0, durations: [] as number[], playing })
  const [size, setSize] = useState({ width: 1, height: 1 })
  const [camera, setCamera] = useState({ longitude: region.center[0] as number, latitude: region.center[1] as number, zoom: region.zoom as number })
  const cameraRef = useRef(camera)
  useLayoutEffect(() => { cameraRef.current = camera }, [camera])
  useEffect(() => attachMapGestures(canvasRef.current!, () => cameraRef.current, next => {
    cameraRef.current = next
    setCamera(next)
  }, ({ x, y }) => {
    const labels = layoutPortLabels(cameraRef.current, size, selectedPort?.id)
    const marker = labels.filter(port => Math.hypot(port.markerX - x, port.markerY - y) < 12).sort((a, b) => Math.hypot(a.markerX - x, a.markerY - y) - Math.hypot(b.markerX - x, b.markerY - y))[0]
    const label = marker ?? labels.find(port => port.labelled && x >= port.x && x <= port.x + port.width && y >= port.y && y <= port.y + port.height)
    const port = ports.find(port => port.id === label?.id)
    if (port) { onSelect(null); onPortSelect(port); setCamera({ longitude: port.position[0], latitude: port.position[1], zoom: 10 }); return }
    const frame = frameRef.current
    onSelect(frame.heads.pick({ ...frame, camera: cameraRef.current, size }, x, y))
  }, maxZoom), [region, onSelect, onPortSelect, selectedPort, size, maxZoom])
  useEffect(() => { setCamera({ longitude: region.center[0], latitude: region.center[1], zoom: region.zoom }) }, [region])
  useEffect(() => {
    const canvas = canvasRef.current!
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])
  const scale = projectionScale(size) * camera.zoom
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
    backdrop.current = buffer
    const canvas = canvasRef.current!
    canvas.width = buffer.width; canvas.height = buffer.height
    canvas.getContext('2d')!.drawImage(buffer, 0, 0)
  // The projection is determined entirely by these camera and size values.
  }, [land, observed, camera, size, gpu])

  useEffect(() => {
    const started = performance.now()
    const canvas = canvasRef.current!
    const context = canvas.getContext('2d')!
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    let drawn = 0
    if (gpu) {
      drawn = gpu.draw(heads, { time, camera, size, visible, selected })
    } else {
      context.setTransform(1, 0, 0, 1, 0, 0)
      if (backdrop.current) context.drawImage(backdrop.current, 0, 0)
      context.scale(ratio, ratio)
      drawn = drawCanvasFleet(context, heads, { time, camera, size, visible, selected })
    }
    const finished = performance.now()
    const drawMs = finished - started
    canvas.dataset.drawn = String(drawn)
    canvas.dataset.renderer = gpu ? 'webgl2' : 'canvas2d'
    canvas.dataset.drawMs = String(drawMs)
    canvas.dataset.frame = String(Number(canvas.dataset.frame ?? 0) + 1)
    const meter = measurements.current
    if (meter.playing !== playing || !meter.since) {
      meter.playing = playing; meter.since = started; meter.durations = []
    }
    meter.durations.push(drawMs)
    // Publish once per second without scheduling another React render. Paused
    // redraws still expose their cost; idle time must never count as a slow frame.
    if (!playing || finished - meter.since >= 1000) {
      const sorted = meter.durations.slice().sort((a, b) => a - b)
      const p95 = sorted[Math.max(0, Math.ceil(sorted.length * .95) - 1)]
      const fps = meter.durations.length * 1000 / (finished - meter.since)
      const output = performanceRef.current!
      output.textContent = `${drawn.toLocaleString('en-US')} marks drawn · ${playing ? `p95 ${p95.toFixed(1)}` : drawMs.toFixed(1)} ms CPU\n${gpu ? 'WebGL' : 'Canvas fallback'} · ${playing ? `${fps.toFixed(1)} draws/s · target 60` : 'Paused · frame budget 16.7 ms'}`
      output.dataset.drawMs = String(p95)
      output.dataset.fps = playing ? String(fps) : ''
      output.dataset.overBudget = String(p95 > 1000 / 60 || (playing && fps < 55))
      meter.since = finished; meter.durations = []
    }
  }, [study, vessels, observed, time, playing, visible, selected, camera, size, gpu, heads])

  const selectedVessel = selected ? vessels.get(selected) : null
  const selectedSegment = selectedVessel && visible.has(selectedVessel.category) ? study.segments.find(segment => segment.vesselId === selected && positionAt(segment, time)) : null
  const selectedPoint = selectedSegment ? positionAt(selectedSegment, time) : null

  return <div className="ocean-scene">
    <canvas ref={canvasRef} aria-label={observed ? 'Regional map of observed NOAA vessel positions near Los Angeles. Interpolated only within accepted track segments. Use region controls and the vessel selector to explore with a keyboard.' : 'World map with synthetic cargo and tanker movement. Use the port search, region controls and vessel selector to explore with a keyboard.'} role="img"
      />
    <canvas ref={fleetCanvasRef} className="fleet-canvas" aria-hidden="true" />
    {selectedPoint && <svg className="vessel-labels" viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true">{[-360, 0, 360].map(shift => {
      const [x, y] = project([selectedPoint[0] + shift, selectedPoint[1]])
      return <text key={shift} x={x + 15} y={y - 10} fill={colors[selectedVessel!.category]}>{selectedVessel!.label.toUpperCase()}</text>
    })}</svg>}
    <output ref={performanceRef} className="performance-readout" role="note" aria-label="Rendering performance" aria-live="off" title="CPU preparation/submission time and completed draws per second, sampled over about one second. A 60 fps frame has 16.7 ms for all work; CPU time excludes React, data loading, browser painting and GPU completion. Marks include wrapped world copies. Every qualifying vessel and full wake duration is retained.">Measuring fleet rendering…</output>
    <PortLabels camera={camera} size={size} selectedPort={selectedPort} onClear={() => onPortSelect(null)} onFocus={port => { onSelect(null); onPortSelect(port); setCamera({ longitude: port.position[0], latitude: port.position[1], zoom: 10 }) }} />
    <div className="map-tools" aria-label="Map controls">
      <button aria-label="Zoom in" data-tooltip="See the vessels more closely" disabled={camera.zoom >= maxZoom} onClick={() => setCamera(current => ({ ...current, zoom: Math.min(maxZoom, current.zoom * 1.4) }))}>+</button>
      <button aria-label="Zoom out" data-tooltip="See more of the ocean" disabled={camera.zoom <= 1} onClick={() => setCamera(current => ({ ...current, zoom: Math.max(1, current.zoom / 1.4) }))}>−</button>
      <button aria-label="Reset map view" data-tooltip="Return to this chapter’s opening view" onClick={() => setCamera({ longitude: region.center[0], latitude: region.center[1], zoom: region.zoom })}>↺</button>
    </div>
    <span className="map-hint">Drag to explore · Pinch to zoom</span>
  </div>
}
