import { useMemo, useRef, useState } from 'react'
import type { MapCamera } from '../maritime/map-gestures'
import { layoutPortLabels, ports, searchPorts, type Port } from '../maritime/port-labels'

export function PortLabels({ camera, size, onFocus }: { camera: MapCamera; size: { width: number; height: number }; onFocus: (port: Port) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string>()
  const toggle = useRef<HTMLButtonElement>(null)
  const labels = useMemo(() => layoutPortLabels(camera, size, selectedId), [camera, size, selectedId])
  const matches = useMemo(() => searchPorts(query), [query])
  const close = () => { setOpen(false); toggle.current?.focus() }
  return <>
    <svg className="port-labels" viewBox={`0 0 ${size.width} ${size.height}`} aria-label={`Ports and passages: ${labels.map(port => port.name).join(', ')}`} role="img">
    {labels.map(port => <g key={port.id} data-port-id={port.id} data-selected={port.id === selectedId}>
      <title>{port.name}</title>
      {port.labelled && <path d={`M${port.markerX},${port.markerY} L${Math.max(port.x, Math.min(port.x + port.width, port.markerX))},${port.y + port.height / 2}`} />}
      <circle cx={port.markerX} cy={port.markerY} r="3" />
      {port.labelled && <>
        <rect x={port.x} y={port.y} width={port.width} height={port.height} rx="3" />
        <text x={port.x + 7} y={port.y + port.height / 2} dominantBaseline="middle">{port.name.toUpperCase()}</text>
      </>}
    </g>)}
    </svg>
    <div className="port-finder" onKeyDown={event => { if (event.key === 'Escape') close() }}>
      <button ref={toggle} aria-expanded={open} aria-controls="port-directory" onClick={() => setOpen(!open)}>Ports · {ports.length} <span>{open ? '−' : '+'}</span></button>
      {open && <section id="port-directory" aria-label="Find a port">
        <label htmlFor="port-search">Find a port</label>
        <input id="port-search" type="search" placeholder="Name or alternate name" value={query} onChange={event => setQuery(event.target.value)} autoFocus />
        <p>Major ports worldwide. Zoom in for more labels.</p>
        <ul>{matches.map(port => <li key={port.id}>
          <button onClick={() => { setSelectedId(port.id); onFocus(port); close() }}>
            <span>{port.name}</span><small>{port.selection === 'container' ? 'Container hub' : port.selection === 'bulk-energy' ? 'Bulk / energy' : port.selection === 'demo' ? 'Demo destination' : 'Regional gateway'}</small>
          </button>
        </li>)}</ul>
        {matches.length === 0 && <p role="status">No matching ports.</p>}
        <p className="port-evidence">Geographic reference · vessel movement is labelled separately.</p>
      </section>}
    </div>
  </>
}
