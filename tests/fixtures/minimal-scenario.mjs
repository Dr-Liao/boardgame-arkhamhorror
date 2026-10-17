// A fourth scenario is installed by adding this module to the composition root.
// Neither engine.js nor web/game-ui.js needs a scenario-name branch.
import { scenarioManifest, layoutFor } from '../../content/scenario-manifest.js'

export const scenario = {
  id: 'minimalScenario', name: '注册契约测试关', startLocation: 'start',
  locations: { start: { id: 'start', name: '起点', connections: [] } },
  encounterDeck: [], acts: [{ id: 'act1' }], agendas: [{ id: 'agenda1' }],
  resolutions: { r1: '完成' },
}
export const identities = { locations: { start: { originalCode: '01113' } } }
export const behavior = { id: scenario.id, setupLocations: () => ['start'] }
export const layout = layoutFor(scenario, { start: { x: 0, y: 0 } })
export const manifest = scenarioManifest(scenario, identities, { layout, behaviorIds: [behavior.id] })
