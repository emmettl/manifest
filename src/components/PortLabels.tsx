import type { MapCamera } from '../maritime/map-gestures'
import { layoutPortLabels } from '../maritime/port-labels'

export function PortLabels({ camera, size }: { camera: MapCamera; size: { width: number; height: number } }) {
  const labels = layoutPortLabels(camera, size)
  return <svg className="port-labels" viewBox={`0 0 ${size.width} ${size.height}`} aria-label={`Ports and passages: ${labels.map(port => port.name).join(', ')}`} role="img">
    {labels.map(port => <g key={port.id} data-port-id={port.id}>
      <path d={`M${port.markerX},${port.markerY} L${Math.max(port.x, Math.min(port.x + port.width, port.markerX))},${port.y + port.height / 2}`} />
      <circle cx={port.markerX} cy={port.markerY} r="3" />
      <rect x={port.x} y={port.y} width={port.width} height={port.height} rx="3" />
      <text x={port.x + 7} y={port.y + port.height / 2} dominantBaseline="middle">{port.name.toUpperCase()}</text>
    </g>)}
  </svg>
}
