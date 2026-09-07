import { useEffect, useMemo, useRef, useState } from 'react'
import type { MapCamera } from '../maritime/map-gestures'
import { layoutPortLabels, ports, searchPorts, type Port } from '../maritime/port-labels'
import { portCategory } from '../maritime/port-statistics'

interface Props {
  camera: MapCamera; size: { width: number; height: number }; selectedPort: Port | null
  onFocus: (port: Port) => void; onClear: () => void
}

export function PortLabels({ camera, size, selectedPort, onFocus, onClear }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const input = useRef<HTMLInputElement>(null)
  const finder = useRef<HTMLDivElement>(null)
  const labels = useMemo(() => layoutPortLabels(camera, size, selectedPort?.id), [camera, size, selectedPort])
  const matches = useMemo(() => searchPorts(query), [query])
  useEffect(() => { setQuery(selectedPort?.name ?? ''); setOpen(false); setActive(-1) }, [selectedPort])
  useEffect(() => {
    const dismiss = (event: PointerEvent) => { if (!finder.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [])
  useEffect(() => {
    if (open && active >= 0) document.getElementById(`port-result-${matches[active]?.id}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open, matches])
  const choose = (port: Port) => { input.current?.focus(); setQuery(port.name); setOpen(false); setActive(-1); onFocus(port) }
  const clear = () => { onClear(); setQuery(''); setActive(-1); input.current?.focus(); setOpen(true) }
  return <>
    <svg className="port-labels" viewBox={`0 0 ${size.width} ${size.height}`} aria-label={`Ports and passages: ${labels.map(port => port.name).join(', ')}`} role="img">
      {labels.map(port => <g key={port.id} data-port-id={port.id} data-selected={port.id === selectedPort?.id}>
        <title>{port.name}</title>
        {port.labelled && <path d={`M${port.markerX},${port.markerY} L${Math.max(port.x, Math.min(port.x + port.width, port.markerX))},${port.y + port.height / 2}`} />}
        <circle cx={port.markerX} cy={port.markerY} r={port.id === selectedPort?.id ? 5 : 3} />
        {port.labelled && <>
          <rect x={port.x} y={port.y} width={port.width} height={port.height} rx="3" />
          <text x={port.x + 7} y={port.y + port.height / 2} dominantBaseline="middle">{port.name.toUpperCase()}</text>
        </>}
      </g>)}
    </svg>
    <div className="port-search" ref={finder} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
      <form role="search" aria-label="Ports" onSubmit={event => { event.preventDefault(); const match = matches[active] ?? matches[0]; if (match) choose(match) }}>
        <svg className="port-search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></svg>
        <label className="sr-only" htmlFor="port-search">Find a port</label>
        <input ref={input} id="port-search" type="search" role="combobox" placeholder="Find a port…" autoComplete="off" value={query}
          aria-describedby="port-search-hint" aria-autocomplete="list" aria-expanded={open} aria-controls="port-results" aria-activedescendant={open && matches[active] ? `port-result-${matches[active].id}` : undefined}
          onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setOpen(true); setActive(-1) }}
          onKeyDown={event => {
            if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setActive(-1) }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault(); setOpen(true)
              setActive(current => matches.length ? event.key === 'ArrowDown' ? (current + 1) % matches.length : current <= 0 ? matches.length - 1 : current - 1 : -1)
            }
          }} />
        {(query || selectedPort) ? <button type="button" className="port-search-clear" aria-label="Clear port search and selection" onClick={clear}>×</button> : <span className="port-search-count">{ports.length}</span>}
      </form>
      <span id="port-search-hint" className="sr-only">Select a port to show its profile below the map. Use arrow keys and Enter to choose a result.</span>
      {open && <div className="port-search-dropdown" style={{ maxHeight: Math.max(130, Math.min(340, size.height - 140)) }}>
        <p role="status">{matches.length ? `${matches.length} ${matches.length === 1 ? 'port' : 'ports'} · select to explore` : 'No matching ports. Try another name.'}</p>
        <ul id="port-results" role="listbox" aria-label="Matching ports">{matches.map((port, index) => <li key={port.id} role="presentation">
          <button id={`port-result-${port.id}`} type="button" role="option" tabIndex={-1} aria-selected={index === active} onMouseDown={event => event.preventDefault()} onClick={() => choose(port)}>
            <span>{port.name}<small>{portCategory(port)}</small></span>
            <span className="port-search-result-mark" aria-hidden="true">↗</span>
          </button>
        </li>)}</ul>
      </div>}
    </div>
  </>
}
