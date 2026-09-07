import { expect, it } from 'vitest'
import fixture from '../../public/data/demo-study.json'
import { ports, layoutPortLabels } from './port-labels'

it('gives both ends of every demo voyage a named port at its exact marker', () => {
  const byId = new Map(ports.map(port => [port.id, port]))
  for (const segment of fixture.segments) {
    expect(byId.has(segment.originPortId)).toBe(true)
    expect(byId.has(segment.destinationPortId)).toBe(true)
    expect(segment.samples[0].position).toEqual(byId.get(segment.originPortId)!.position)
    expect(segment.samples.at(-1)!.position).toEqual(byId.get(segment.destinationPortId)!.position)
  }
})

it('labels every port in the opening world view, without overlapping or escaping the viewport', () => {
  const viewport = { width: 1920, height: 680 }
  const labels = layoutPortLabels({ longitude: 22, latitude: 10, zoom: 1 }, viewport)
  expect(labels).toHaveLength(ports.length)
  for (const [index, label] of labels.entries()) {
    expect(label.x).toBeGreaterThanOrEqual(0)
    expect(label.y).toBeGreaterThanOrEqual(0)
    expect(label.x + label.width).toBeLessThanOrEqual(viewport.width)
    expect(label.y + label.height).toBeLessThanOrEqual(viewport.height)
    for (const other of labels.slice(index + 1)) expect(label.x < other.x + other.width && label.x + label.width > other.x && label.y < other.y + other.height && label.y + label.height > other.y).toBe(false)
  }
})

it('separates Los Angeles and Long Beach labels at regional zoom', () => {
  const labels = layoutPortLabels({ longitude: -118.23, latitude: 33.74, zoom: 10 }, { width: 900, height: 400 })
  expect(labels.map(label => label.id).sort()).toEqual(['long-beach', 'los-angeles'])
  expect(labels[0].y).not.toBe(labels[1].y)
})
