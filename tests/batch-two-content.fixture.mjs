import { contentRegistry } from '../content/registered.js'
import { bindScenarioIdentities } from '../content/identities.js'
import { layoutFor, scenarioManifest } from '../content/scenario-manifest.js'

function chapter(campaignId, id, name, effects = []) {
  const scenario = {
    id, name, startLocation: 'bench', resignAnywhere: true,
    setup: '将调查员放在工作台。', setupNote: '从工作台开始。',
    locations: { bench: { id: 'bench', name: '工作台', shroud: 0, cluesPerInvestigator: 0, connections: [] } },
    acts: [{ id: 'measure', stage: '1a', name: '测量', objective: { type: 'manual' } }],
    agendas: [{ id: 'timer', stage: '1a', name: '计时', doomThreshold: 9 }],
    encounterDeck: [], enemies: {}, treacheries: {}, storyAssets: {},
    mechanics: { noEncounterDeck: true },
    resolutions: { r1: '校验结束。' },
  }
  const identities = { locations: { bench: { originalCode: '01113' } } }
  bindScenarioIdentities(scenario, identities)
  const behavior = { id, setupLocations: () => ['bench'], allResigned: (_, { finish }) => finish('r1'),
    resolution: () => ({ award: false, effects }) }
  return { scenario, behavior, manifest: scenarioManifest(scenario, identities, {
    campaignId, layout: layoutFor(scenario, { bench: { x: 0, y: 0 } }), behaviorIds: [id],
  }) }
}

export function batchTwoFixture(id, standalone = false) {
  const template = contentRegistry.getCampaign('nightOfTheZealot')
  const reward = [{ xp: 3, trauma: { mental: 1 }, record: { instrumentRepaired: true } }]
  const entries = standalone ? [chapter(id, id + 'Calibration', '独立校验', reward)] : [
    chapter(id, id + 'Survey', '设备巡检', [{ xp: 4 }]),
    chapter(id, id + 'Repair', '临时检修', reward),
    chapter(id, id + 'Signoff', '确认复工'),
  ]
  const scenarioIds = entries.map(entry => entry.scenario.id)
  const options = [
    { id: 'repair', label: '临时检修（每人 2 XP）', when: { eachInvestigatorXp: 2 }, effects: [{ type: 'spendExperience', amount: 2 }], next: 'repair' },
    { id: 'continue', label: '继续巡检', next: 'signoff' },
  ]
  const nodes = standalone ? { start: { type: 'scenario', scenarioId: scenarioIds[0], next: 'end' } } : {
    start: { type: 'scenario', scenarioId: scenarioIds[0], next: 'choice' },
    choice: { type: 'choice', options },
    repair: { type: 'scenario', scenarioId: scenarioIds[1], next: 'signoff' },
    signoff: { type: 'scenario', scenarioId: scenarioIds[2], next: 'end' },
  }
  const campaign = {
    id, name: standalone ? '独立设备校验' : '设备巡检与复工',
    schemaVersion: template.schemaVersion, contentVersion: template.contentVersion, minRulesVersion: template.minRulesVersion,
    requiredPackIds: [...template.requiredPackIds, 'rtdwlPlayer'], status: 'playable',
    opening: { experience: standalone ? 4 : 0, investigators: ['90017'] },
    scenarioIds, unlock: Object.fromEntries(scenarioIds.map(code => [code, []])),
    chaosBags: { ...structuredClone(template.chaosBags), hard: ['-4', '-3'] },
    recordSchema: { instrumentRepaired: 'boolean' }, interludeHandlerId: id, resolutionIds: ['workshopComplete'],
    flow: { start: 'start', nodes: { ...nodes, end: { type: 'end' } } },
  }
  return { campaigns: [campaign], scenarios: entries }
}
