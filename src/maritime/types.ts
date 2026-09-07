/** Geographic coordinates are [longitude, latitude]; time is seconds from study start. */
export type Position = readonly [number, number]
export type VesselClass = 'cargo' | 'tanker' | 'other'
export type Evidence = 'synthetic' | 'observed'
export interface Sample { time: number; position: Position }
export interface TrackSegment { id: string; vesselId: string; originPortId?: string; destinationPortId?: string; samples: Sample[] }
export interface OperatorAttribution {
  imo: string
  groupId: string
  operatorName: string
  role: 'commercial-operator'
  validFrom: string
  validTo: string
  evidenceNote: string
  source: { label: string; url: string; retrievedUtc: string }
}
export interface Vessel { id: string; label: string; category: VesselClass; evidence: Evidence; mmsi?: string; imo?: string; reportedName?: string; operator?: OperatorAttribution }
export interface StudySource {
  id: string
  label: string
  evidence: Evidence
  license: string
  publication: 'synthetic-only' | 'review-required' | 'approved'
  url?: string
  classification?: string
}
export interface TrackStudy {
  schemaVersion: 1
  kind: 'tracks'
  id: string
  title: string
  startUtc: string
  duration: number
  source: StudySource
  vessels: Vessel[]
  segments: TrackSegment[]
  audit?: { maxGapSeconds: number; maxSpeedKnots: number; gapSplits: number; speedSplits: number; classSplits: number }
}
/** Presence is deliberately not a track: it cannot drive a directional vessel mark. */
export interface PresenceStudy {
  schemaVersion: 1
  kind: 'presence'
  id: string
  startUtc: string
  duration: number
  source: StudySource
  cells: { time: number; position: Position; vesselHours: number; category: VesselClass }[]
}
export type MaritimeStudy = TrackStudy | PresenceStudy
export interface LandGeometry { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] }
export interface LandCollection { type: 'FeatureCollection'; features: { geometry: LandGeometry }[] }
