export interface MapCamera { longitude: number; latitude: number; zoom: number }
export interface ScreenPoint { x: number; y: number }
interface Viewport { width: number; height: number }
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const midpoint = (a: ScreenPoint, b: ScreenPoint) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const distance = (a: ScreenPoint, b: ScreenPoint) => Math.hypot(a.x - b.x, a.y - b.y)

/** Keep the geographic point under `from` beneath `to` after zooming. */
export function transformCamera(camera: MapCamera, from: ScreenPoint, to: ScreenPoint, factor: number, viewport: Viewport): MapCamera {
  const base = Math.min(viewport.width / 360, viewport.height / 150) * .9
  if (base <= 0 || !Number.isFinite(factor) || factor <= 0) return camera
  const zoom = clamp(camera.zoom * factor, 1, 10)
  const longitude = camera.longitude + (from.x - viewport.width / 2) / (base * camera.zoom) - (to.x - viewport.width / 2) / (base * zoom)
  const latitude = camera.latitude - (from.y - viewport.height / 2) / (base * camera.zoom) + (to.y - viewport.height / 2) / (base * zoom)
  return { longitude: clamp(longitude, -180, 180), latitude: clamp(latitude, -60, 70), zoom }
}

export class PointerGesture {
  private pointers = new Map<number, ScreenPoint>()
  private baseline: { points: ScreenPoint[]; camera: MapCamera } | null = null
  private moved = false
  get count() { return this.pointers.size }
  private rebase(camera: MapCamera) { this.baseline = { points: [...this.pointers.values()].slice(0, 2), camera } }
  down(id: number, point: ScreenPoint, camera: MapCamera) {
    if (!this.pointers.size) this.moved = false
    this.pointers.set(id, point)
    if (this.pointers.size > 1) this.moved = true
    this.rebase(camera)
  }
  move(id: number, point: ScreenPoint, viewport: Viewport): MapCamera | null {
    if (!this.pointers.has(id) || !this.baseline) return null
    this.pointers.set(id, point)
    const points = [...this.pointers.values()].slice(0, 2)
    const start = this.baseline
    let camera: MapCamera
    if (points.length === 2) {
      const separation = distance(start.points[0], start.points[1])
      const factor = separation > 2 ? Math.max(1, distance(points[0], points[1])) / separation : 1
      camera = transformCamera(start.camera, midpoint(start.points[0], start.points[1]), midpoint(points[0], points[1]), factor, viewport)
    } else {
      if (distance(start.points[0], points[0]) > 5) this.moved = true
      if (!this.moved) return null
      camera = transformCamera(start.camera, start.points[0], points[0], 1, viewport)
    }
    this.rebase(camera)
    return camera
  }
  up(id: number, camera: MapCamera, cancelled = false): boolean {
    if (!this.pointers.has(id)) return false
    const tap = this.pointers.size === 1 && !this.moved && !cancelled
    if (cancelled) this.moved = true
    this.pointers.delete(id)
    if (this.pointers.size) this.rebase(camera)
    else this.baseline = null
    return tap
  }
}

interface SafariGestureEvent extends Event { scale: number; clientX?: number; clientY?: number }

/** Native non-passive listeners keep trackpad pinch inside the canvas, not the page. */
export function attachMapGestures(element: HTMLElement, readCamera: () => MapCamera, writeCamera: (camera: MapCamera) => void, onTap: (point: ScreenPoint) => void) {
  const pointers = new PointerGesture()
  const lifecycle = new AbortController()
  const options = { signal: lifecycle.signal, passive: false }
  const local = (event: { clientX?: number; clientY?: number }): ScreenPoint => {
    const rect = element.getBoundingClientRect()
    return { x: event.clientX === undefined ? rect.width / 2 : event.clientX - rect.left, y: event.clientY === undefined ? rect.height / 2 : event.clientY - rect.top }
  }
  let safari: { camera: MapCamera; anchor: ScreenPoint } | null = null
  element.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    element.setPointerCapture(event.pointerId)
    pointers.down(event.pointerId, local(event), readCamera())
  }, options)
  element.addEventListener('pointermove', event => {
    const next = pointers.move(event.pointerId, local(event), element.getBoundingClientRect())
    if (next) writeCamera(next)
  }, options)
  element.addEventListener('pointerup', event => {
    // Process a final position even if no move event arrived before lift-off.
    const next = pointers.move(event.pointerId, local(event), element.getBoundingClientRect())
    if (next) writeCamera(next)
    if (pointers.up(event.pointerId, readCamera())) onTap(local(event))
  }, options)
  const cancel = (event: PointerEvent) => { pointers.up(event.pointerId, readCamera(), true) }
  element.addEventListener('pointercancel', cancel, options)
  element.addEventListener('lostpointercapture', cancel, options)
  element.addEventListener('wheel', event => {
    if (!event.ctrlKey) return // Ordinary scrolling still scrolls the page.
    event.preventDefault()
    if (safari || pointers.count > 1) return
    const rect = element.getBoundingClientRect()
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1)
    const anchor = local(event)
    writeCamera(transformCamera(readCamera(), anchor, anchor, Math.exp(clamp(-delta * .01, -1, 1)), rect))
  }, options)
  // Safari trackpads use GestureEvents; touch PointerEvents remain the authority on iOS.
  element.addEventListener('gesturestart', event => {
    event.preventDefault()
    safari = { camera: readCamera(), anchor: local(event as SafariGestureEvent) }
  }, options)
  element.addEventListener('gesturechange', event => {
    event.preventDefault()
    if (!safari || pointers.count > 0) return
    const gesture = event as SafariGestureEvent
    writeCamera(transformCamera(safari.camera, safari.anchor, local(gesture), gesture.scale, element.getBoundingClientRect()))
  }, options)
  element.addEventListener('gestureend', event => { event.preventDefault(); safari = null }, options)
  return () => lifecycle.abort()
}
