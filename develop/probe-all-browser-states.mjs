// 逐章跑浏览器 spec 的 Node 侧建局（createGameState + settle），报告首个失败点。
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { manifest as tcuCampaignPack } from '../content/packs/tcuCampaign/manifest.js'
import { manifest as tcuInvestigators } from '../content/packs/tcuInvestigators/manifest.js'
import { manifest as tcuPlayer } from '../content/packs/tcuPlayer/manifest.js'

const chapters = ['disappearanceAtTheTwilightEstate', 'theWitchingHour', 'atDeathsDoorstep', 'theSecretName',
  'theWagesOfSin', 'forTheGreaterGood', 'unionAndDisillusion', 'inTheClutchesOfChaos', 'beforeTheBlackThrone']
const packSuffix = 'TcuProbeShell'
const packIdMap = {
  tcuCampaign: `tcuCampaign${packSuffix}`,
  tcuInvestigators: `tcuInvestigators${packSuffix}`,
  tcuPlayer: `tcuPlayer${packSuffix}`,
}
registerContentBundle({
  packs: [
    { ...tcuCampaignPack, id: packIdMap.tcuCampaign, status: 'playable' },
    { ...tcuInvestigators, id: packIdMap.tcuInvestigators, status: 'playable' },
    { ...tcuPlayer, id: packIdMap.tcuPlayer, status: 'playable', basicWeaknessCodes: [...(tcuPlayer.basicWeaknessCodes || [])] },
  ],
})
const tcu = contentRegistry.getCampaign('theCircleUndone')
const campaigns = []
const scenarios = []
for (const chapterId of chapters) {
  let module
  try {
    module = await import(`../content/campaigns/theCircleUndone/scenarios/${chapterId}/index.js`)
  } catch (error) {
    console.log(`${chapterId}: import FAIL ${error.message.split('\n')[0]}`)
    continue
  }
  const shellScenarioId = `${chapterId}ProbeShell`
  const shellCampaignId = `${chapterId}ProbeCampaign`
  const requiredPackIds = [...new Set([...module.manifest.requiredPackIds, 'tcuCampaign', 'tcuInvestigators', 'tcuPlayer'])]
    .map(id => packIdMap[id] || id)
  campaigns.push({
    id: shellCampaignId, name: module.manifest.name, nameEn: module.manifest.nameEn || module.manifest.name,
    schemaVersion: module.manifest.schemaVersion, contentVersion: module.manifest.contentVersion,
    minRulesVersion: module.manifest.minRulesVersion, status: 'playable', requiredPackIds,
    scenarioIds: [shellScenarioId], unlock: { [shellScenarioId]: [] },
    chaosBags: tcu.chaosBags, recordSchema: tcu.recordSchema, recordDefaults: tcu.recordDefaults,
    recordLabels: tcu.recordLabels, mementoLabels: tcu.mementoLabels,
    interludeHandlerId: tcu.interludeHandlerId, resolutionIds: tcu.resolutionIds,
    flow: { start: shellScenarioId, nodes: { [shellScenarioId]: { type: 'scenario', scenarioId: shellScenarioId, next: 'end' }, end: { type: 'end' } } },
  })
  scenarios.push({
    scenario: { ...module.scenario, id: shellScenarioId },
    behavior: { ...module.behavior, id: shellScenarioId },
    manifest: {
      ...module.manifest, id: shellScenarioId, campaignId: shellCampaignId, status: 'playable',
      requiredPackIds, requiredMechanicIds: [], requiredEncounterGroupIds: [], behaviorIds: [shellScenarioId],
    },
  })
}
registerContentBundle({ campaigns, scenarios })

const { createGameState, applyMove } = await import('../src/engine/engine.js')
for (const chapterId of chapters) {
  try {
    const state = createGameState({
      campaignId: `${chapterId}ProbeCampaign`, seed: `probe-${chapterId}`, playerInvestigator: '01001',
    }, [{ seat: 0 }])
    let guard = 0
    while (state.pendingChoice && guard++ < 80) {
      const pending = state.pendingChoice
      const optionId = pending.options.find(option => ['done', 'skip'].includes(option.id))?.id || pending.options[0].id
      applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
    }
    console.log(`${chapterId}: OK → uiState=${state.uiState} phase=${state.phase} loc=${state.locations?.length} scenario=${state.scenario?.name}`)
  } catch (error) {
    console.log(`${chapterId}: FAIL ${error.message}`)
    console.log('   at', (error.stack || '').split('\n')[1]?.trim())
  }
}
