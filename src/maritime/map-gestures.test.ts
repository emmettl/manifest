import { describe, expect, it } from 'vitest'
import { attachMapGestures, PointerGesture, transformCamera, type MapCamera } from './map-gestures'

const viewport = { width: 1000, height: 500 }
const initial: MapCamera = { longitude: 22, latitude: 10, zoom: 2 }
const base = viewport.height / 130
const geoAt = (camera: MapCamera, x: number, y: number) => [camera.longitude + (x - 500) / (base * camera.zoom), camera.latitude - (y - 250) / (base * camera.zoom)]

describe('map gesture geometry', () => {
  it('keeps the geographic anchor under the moving pinch midpoint', () => {
    const next = transformCamera(initial, { x: 700, y: 300 }, { x: 650, y: 320 }, 2, viewport)
    expect(next.zoom).toBe(4)
    geoAt(next, 650, 320).forEach((value, i) => expect(value).toBeCloseTo(geoAt(initial, 700, 300)[i]))
  })
  it('respects the zoom bounds without moving a centered pinch', () => {
    const center = { x: 500, y: 250 }
    expect(transformCamera(initial, center, center, 100, viewport)).toEqual({ ...initial, zoom: 10 })
    expect(transformCamera(initial, center, center, .001, viewport)).toEqual({ ...initial, zoom: 1 })
    expect(transformCamera(initial, center, center, NaN, viewport)).toEqual(initial)
  })
  it('continues panning after one finger lifts, without a jump or a tap', () => {
    const gesture = new PointerGesture()
    gesture.down(1, { x: 400, y: 250 }, initial)
    gesture.down(2, { x: 600, y: 250 }, initial)
    let camera = gesture.move(2, { x: 800, y: 250 }, viewport)!
    expect(camera.zoom).toBe(4)
    expect(gesture.up(2, camera)).toBe(false)
    expect(gesture.move(1, { x: 400, y: 250 }, viewport)).toEqual(camera)
    const before = camera
    camera = gesture.move(1, { x: 450, y: 250 }, viewport)!
    expect(camera.longitude).toBeCloseTo(before.longitude - 50 / (base * 4))
    expect(gesture.up(1, camera)).toBe(false)
  })
  it('does not select on cancel, capture loss, or a stationary two-finger gesture', () => {
    const gesture = new PointerGesture()
    gesture.down(1, { x: 400, y: 250 }, initial)
    gesture.down(2, { x: 600, y: 250 }, initial)
    expect(gesture.up(2, initial)).toBe(false)
    expect(gesture.up(1, initial)).toBe(false)
    gesture.down(3, { x: 400, y: 250 }, initial)
    expect(gesture.up(3, initial, true)).toBe(false)
    expect(gesture.up(3, initial)).toBe(false)
    gesture.down(4, { x: 400, y: 250 }, initial)
    expect(gesture.up(4, initial)).toBe(true)
  })
  it('reverses immediately after reaching the zoom limit', () => {
    const gesture = new PointerGesture()
    gesture.down(1, { x: 400, y: 250 }, { ...initial, zoom: 9 })
    gesture.down(2, { x: 600, y: 250 }, { ...initial, zoom: 9 })
    expect(gesture.move(2, { x: 800, y: 250 }, viewport)!.zoom).toBe(10)
    expect(gesture.move(2, { x: 760, y: 250 }, viewport)!.zoom).toBe(9)
  })
})

class CanvasTarget extends EventTarget {
  getBoundingClientRect() { return { ...viewport, left: 10, top: 20 } }
  setPointerCapture() {}
}
function setup() {
  const element = new CanvasTarget()
  let camera = { ...initial }, taps = 0
  const cleanup = attachMapGestures(element as unknown as HTMLElement, () => camera, next => { camera = next }, () => { taps++ })
  const send = (type: string, values: object = {}) => {
    const event = new Event(type, { cancelable: true })
    Object.assign(event, { pointerId: 1, pointerType: 'touch', button: 0, clientX: 510, clientY: 270 }, values)
    element.dispatchEvent(event)
    return event
  }
  return { send, cleanup, camera: () => camera, taps: () => taps }
}

describe('native canvas gesture listeners', () => {
  it('zooms with actual two-pointer event sequences and never selects on lift', () => {
    const view = setup()
    view.send('pointerdown', { pointerId: 1, clientX: 410 })
    view.send('pointerdown', { pointerId: 2, clientX: 610 })
    view.send('pointermove', { pointerId: 1, clientX: 310 })
    view.send('pointermove', { pointerId: 2, clientX: 710 })
    expect(view.camera().zoom).toBeCloseTo(4)
    expect(view.camera().longitude).toBeCloseTo(initial.longitude)
    view.send('pointerup', { pointerId: 2, clientX: 710 })
    view.send('pointerup', { pointerId: 1, clientX: 310 })
    expect(view.taps()).toBe(0)
    view.cleanup()
  })
  it('handles trackpad pinch while leaving ordinary page scrolling alone', () => {
    const view = setup()
    const scroll = view.send('wheel', { ctrlKey: false, deltaY: -50, deltaMode: 0 })
    expect(scroll.defaultPrevented).toBe(false)
    expect(view.camera()).toEqual(initial)
    const pinch = view.send('wheel', { ctrlKey: true, deltaY: -50, deltaMode: 0 })
    expect(pinch.defaultPrevented).toBe(true)
    expect(view.camera().zoom).toBeGreaterThan(initial.zoom)
    view.cleanup()
    const previous = view.camera()
    view.send('wheel', { ctrlKey: true, deltaY: -50, deltaMode: 0 })
    expect(view.camera()).toEqual(previous)
  })
  it('supports cumulative Safari trackpad scale without also applying wheel zoom', () => {
    const view = setup()
    view.send('gesturestart', { scale: 1 })
    view.send('gesturechange', { scale: 1.5 })
    expect(view.camera().zoom).toBe(3)
    view.send('wheel', { ctrlKey: true, deltaY: -50, deltaMode: 0 })
    expect(view.camera().zoom).toBe(3)
    view.send('gesturechange', { scale: 2 })
    expect(view.camera().zoom).toBe(4)
    view.send('gestureend')
    view.cleanup()
  })
  it('preserves taps and suppresses selection after cancelled or final-position drags', () => {
    const view = setup()
    view.send('pointerdown'); view.send('pointerup')
    expect(view.taps()).toBe(1)
    view.send('pointerdown'); view.send('pointercancel'); view.send('pointerup')
    expect(view.taps()).toBe(1)
    view.send('pointerdown'); view.send('pointerup', { clientX: 600 })
    expect(view.taps()).toBe(1)
    view.cleanup()
  })
})
