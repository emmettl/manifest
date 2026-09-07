import { expect, it } from 'vitest'
import fixture from '../../public/data/demo-study.json'
import { ports, layoutPortLabels, searchPorts } from './port-labels'

it('gives both ends of every demo voyage a named port at its exact marker', () => {
  const byId = new Map(ports.map(port => [port.id, port]))
  for (const segment of fixture.segments) {
    expect(byId.has(segment.originPortId)).toBe(true)
    expect(byId.has(segment.destinationPortId)).toBe(true)
    expect(segment.samples[0].position).toEqual(byId.get(segment.originPortId)!.position)
    expect(segment.samples.at(-1)!.position).toEqual(byId.get(segment.destinationPortId)!.position)
  }
})

it('retains every world marker and places visible labels without overlap', () => {
  const viewport = { width: 1920, height: 680 }
  const labels = layoutPortLabels({ longitude: 22, latitude: 10, zoom: 1 }, viewport)
  expect(labels).toHaveLength(ports.length)
  const named = labels.filter(label => label.labelled)
  for (const [index, label] of named.entries()) {
    expect(label.x).toBeGreaterThanOrEqual(0)
    expect(label.y).toBeGreaterThanOrEqual(0)
    expect(label.x + label.width).toBeLessThanOrEqual(viewport.width)
    expect(label.y + label.height).toBeLessThanOrEqual(viewport.height)
    for (const other of named.slice(index + 1)) expect(label.x < other.x + other.width && label.x + label.width > other.x && label.y < other.y + other.height && label.y + label.height > other.y).toBe(false)
  }
})

it('separates Los Angeles and Long Beach labels at regional zoom', () => {
  const labels = layoutPortLabels({ longitude: -118.23, latitude: 33.74, zoom: 10 }, { width: 900, height: 400 })
  const adjacent = labels.filter(label => ['long-beach', 'los-angeles'].includes(label.id))
  expect(adjacent).toHaveLength(2)
  expect(adjacent.every(label => label.labelled)).toBe(true)
  expect(adjacent[0].y).not.toBe(adjacent[1].y)
})

it('covers all top 50 container port systems, preserves unique markers and supports aliases', () => {
  expect(ports.map(port => port.containerRank2024).filter(rank => rank !== undefined).sort((a, b) => a! - b!)).toEqual(Array.from({ length: 50 }, (_, index) => index + 1))
  expect(new Set(ports.map(port => port.id)).size).toBe(ports.length)
  for (const id of ['port-hedland', 'ras-tanura', 'ras-laffan', 'durban', 'mombasa', 'callao', 'vancouver', 'auckland']) expect(ports.some(port => port.id === id)).toBe(true)
  expect(searchPorts('  shenzhen  ').map(port => port.id)).toContain('yantian')
  expect(searchPorts('nhava').map(port => port.id)).toContain('nhava-sheva')
  expect(searchPorts('nonexistent port')).toEqual([])
  // These names are shared by ports on different continents.
  expect(ports.find(port => port.id === 'sydney')!.position[0]).toBeGreaterThan(150)
  expect(ports.find(port => port.id === 'sydney')!.position[1]).toBeLessThan(-30)
  expect(ports.find(port => port.id === 'vancouver')!.position[1]).toBeGreaterThan(49)
})

it('can reveal a label for every port, including dense coastlines and mobile viewports', () => {
  for (const viewport of [{ width: 390, height: 340 }, { width: 1920, height: 680 }]) {
    for (const port of ports) {
      const labels = layoutPortLabels({ longitude: port.position[0], latitude: port.position[1], zoom: 10 }, viewport, port.id)
      const selected = labels.find(label => label.id === port.id)!
      expect(selected.labelled, port.name).toBe(true)
      expect(selected.markerX).toBeCloseTo(viewport.width / 2)
      expect(selected.markerY).toBeCloseTo(viewport.height / 2)
    }
  }
})
