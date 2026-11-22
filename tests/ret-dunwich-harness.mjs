// 重返敦威治遗产测试专用 harness（文件名前缀 ret-dunwich- 属本批 worker 作用域）。
//
// 目标：在**真实引擎**里注册一个临时战役，跑完整 startScenario 布置，而不依赖
// Lead 尚未合并的战役注册。临时 pack 只服务测试，覆盖 51000–51999 的重返卡号。
import assert from 'node:assert/strict'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { createGameState, applyMove, validateMove } from '../src/engine/engine.js'
import { contentRegistry, registerContentBundle } from '../content/registered.js'

const RET_PACK_ID = 'rtdwlScenarioAcceptancePack'

function ensureRetPack() {
  if (contentRegistry.getPack?.(RET_PACK_ID)) return
  const seen = new Set()
  const cards = Object.values(ALL_CARDS)
    .filter(card => card.pack === 'rtdwl')
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(card => {
      assert.ok(!seen.has(card.code), `重复卡号 ${card.code}`)
      seen.add(card.code)
      return {
        code: card.code, type: ['player', 'encounter', 'other'].includes(card.type) ? card.type : 'encounter',
        cataloged: true, imageAvailable: false, rulesImplemented: false, deckbuilding: false,
      }
    })
  registerContentBundle({
    packs: [{
      schemaVersion: 1, id: RET_PACK_ID, contentVersion: '1.0.0', minRulesVersion: 'n4.2',
      status: 'playable', dependencies: ['core', 'dunwichCampaign'],
      cardRanges: [{ from: '51000', to: '51999' }, { from: '51000a', to: '51999z' }], cards,
      encounterGroupIds: [], behaviorIds: [],
    }],
  })
}

export function settle(state, limit = 200) {
  for (let count = 0; state.pendingChoice; count++) {
    assert.ok(count < limit, `选择循环未收敛：${state.pendingChoice?.prompt || ''}`)
    const pending = state.pendingChoice
    const optionId = pending.options.find(option => ['done', 'skip'].includes(option.id))?.id
      || pending.options[0].id
    const seat = pending.seat ?? state.currentSeat
    const move = { action: 'choose', choiceId: pending.id, optionId }
    assert.equal(validateMove(state, seat, move), null, `非法选择 ${optionId}`)
    applyMove(state, seat, move)
  }
  return state
}

// 注册一个临时战役 + 章节（真实引擎跑 setup）。返回 { campaignId, scenarioId }。
const registered = new Map()
export function registerTrial(chapter, { chapterId, seed } = {}) {
  ensureRetPack()
  const campaignId = `${chapterId}TrialCampaign`
  const scenarioId = `${chapterId}Trial`
  if (registered.has(chapterId)) return registered.get(chapterId)
  const baseCampaign = contentRegistry.getCampaign('theDunwichLegacy')
  const trialScenario = {
    ...chapter.scenario, id: scenarioId, name: chapter.scenario.name,
  }
  registerContentBundle({
    campaigns: [{
      ...baseCampaign, id: campaignId, status: 'playable',
      scenarioIds: [scenarioId], unlock: { [scenarioId]: [] },
      requiredPackIds: ['core', 'dunwichCampaign', RET_PACK_ID],
      chaosBags: baseCampaign.chaosBags,
      flow: { start: scenarioId, nodes: {
        [scenarioId]: { type: 'scenario', scenarioId, next: 'end' },
        end: { type: 'end' },
      } },
    }],
    scenarios: [{
      scenario: trialScenario,
      behavior: { ...chapter.behavior, id: scenarioId },
      manifest: {
        ...chapter.manifest, id: scenarioId, campaignId, status: 'playable',
        requiredPackIds: ['core', 'dunwichCampaign', RET_PACK_ID], requiredEncounterGroupIds: [],
        requiredMechanicIds: [], behaviorIds: [scenarioId],
      },
    }],
  })
  const trial = { campaignId, scenarioId, seed }
  registered.set(chapterId, trial)
  return trial
}

export function fixture(chapter, { chapterId, seed, players = 1 } = {}) {
  const trial = registerTrial(chapter, { chapterId, seed })
  const state = createGameState(
    { campaignId: trial.campaignId, seed: seed || `ret-dunwich-${chapterId}`, playerInvestigator: '01001' },
    Array.from({ length: players }, (_, seat) => ({ seat })),
  )
  settle(state)
  return state
}
