import { regions } from './regions'

export function validateNavigation(input: unknown): { region: string; day: number } {
  if (!input || typeof input !== 'object') throw new Error('Provide a region and demo day.')
  const value = input as Record<string, unknown>
  if (Object.keys(value).some(key => !['region', 'day'].includes(key)) || !regions.some(region => region.id === value.region) || typeof value.day !== 'number' || !Number.isFinite(value.day) || value.day < 1 || value.day > 30) throw new Error('Choose world, china, hormuz, malacca or suez, and a demo day from 1 to 30.')
  return { region: String(value.region), day: value.day }
}

interface ModelContext {
  registerTool(tool: { name: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean }; execute: (input: unknown) => unknown }, options: { signal: AbortSignal }): void | Promise<void>
}

/** Optional page-scoped WebMCP navigation; no effect in browsers without support. */
export function registerAgentNavigation(navigate: (region: string, day: number) => void) {
  const context = (document as Document & { modelContext?: ModelContext }).modelContext
  if (!context?.registerTool) return
  const lifecycle = new AbortController()
  try {
    void Promise.resolve(context.registerTool({
      name: 'navigate_manifest_study',
      description: 'Navigate the synthetic MANIFEST study to a region and demo day, pausing playback for inspection. No observed AIS data is shown.',
      inputSchema: { type: 'object', properties: { region: { type: 'string', enum: regions.map(region => region.id) }, day: { type: 'number', minimum: 1, maximum: 30 } }, required: ['region', 'day'], additionalProperties: false },
      annotations: { readOnlyHint: false },
      execute(input) { const target = validateNavigation(input); navigate(target.region, target.day); return { ...target, playing: false, evidence: 'synthetic' } },
    }, { signal: lifecycle.signal })).catch(() => lifecycle.abort())
  } catch { lifecycle.abort() }
  return () => lifecycle.abort()
}
