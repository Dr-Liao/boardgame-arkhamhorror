// 复现脚本：手牌中有隐私弱点 03084d（「你不能打出事件」）时，快速事件 01023 闪躲是否仍被列出。
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { createGameState, applyMove } from '../src/engine/engine.js'
import { reactionWindow } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { manifest as carcosaPack } from '../content/packs/carcosaCampaign/manifest.js'
import * as oath from '../content/campaigns/thePathToCarcosa/scenarios/theUnspeakableOath/index.js'

const trialPackId = 'reproCarcosaPack'
const scenarioId = 'reproOathScenario'
const campaignId = 'reproOathCampaign'

registerContentBundle({ packs: [{ ...carcosaPack, id: trialPackId, status: 'playable' }] })
const production = oath.behavior
registerContentBundle({
  campaigns: [{
    ...contentRegistry.getCampaign('thePathToCarcosa'), id: campaignId, status: 'playable',
    scenarioIds: [scenarioId], unlock: { [scenarioId]: [] }, requiredPackIds: ['core', trialPackId],
    flow: { start: scenarioId, nodes: { [scenarioId]: { type: 'scenario', scenarioId, next: 'end' }, end: { type: 'end' } } },
  }],
  scenarios: [{
    scenario: { ...oath.scenario, id: scenarioId },
    behavior: {
      ...production, id: scenarioId,
      actions(state, inv) {
        return [...(production.actions?.(state, inv) || []),
          { action: 'scenarioAction', rule: 'm4DrawEncounter', actions: 0, label: 'M4 抽遭遇牌' }]
      },
      performAction(state, inv, move, api) {
        if (move.rule === 'm4DrawEncounter') return api.drawEncounter(inv.seat)
        return production.performAction?.(state, inv, move, api)
      },
    },
    manifest: { ...oath.manifest, id: scenarioId, campaignId, status: 'playable', requiredMechanicIds: [], requiredEncounterGroupIds: [], requiredPackIds: ['core', trialPackId], behaviorIds: [scenarioId] },
  }],
})

function settle(state) {
  for (let guard = 0; state.pendingChoice; guard++) {
    if (guard > 200) throw new Error('choice loop')
    const pending = state.pendingChoice
    const optionId = pending.options.find(option => ['done', 'skip'].includes(option.id))?.id || pending.options[0].id
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
  }
}

const state = createGameState({ campaignId, seed: 'repro-hidden', playerInvestigator: '01001' }, [{ seat: 0 }])
settle(state)
state.currentSeat = 0
state.phase = 'investigation'
state.turnSerial = 1
state.investigators[0].actionsLeft = 20
state.investigators[0].hand = []
state.investigators[0].discard = []
state.investigators[0].hiddenCards = []
state.investigators[0].assets = []
state.investigators[0].threat = []
state.enemies = []

// 1) 抽到隐私弱点 03084d（秘密加入手牌）
state.encounterDeck = ['03084d']
state.encounterDiscard = []
applyMove(state, 0, { action: 'scenarioAction', rule: 'm4DrawEncounter' })
settle(state)
const inv = state.investigators[0]
console.log('hand after hidden draw:', inv.hand, 'hiddenCards:', inv.hiddenCards)

// 2) 手里放一张闪躲，并给足资源
inv.hand.push('01023')
inv.resources = 5

// 3) 敌人攻击窗口：查看候选里是否有闪躲
const execute = current => reactionWindow(current, 'enemyAttack', {
  when: 'enemyAttack', seat: 0, location: current.investigators[0].location,
  enemy: { id: 'repro-enemy', code: '03088', name: '毕宿五的野兽', massive: true, elite: true, damage: 2, horror: 2 },
  attackKind: 'enemy', prompt: '「毕宿五的野兽」攻击',
}, [])
resolveTransaction(state, 0, { action: 'reproProbe' }, execute)
const pending = state.pendingChoice
console.log('pendingChoice kind:', pending?.kind)
console.log('options:', pending?.options?.map(option => ({ id: option.id, label: option.label, cardCode: option.cardCode })))
const offered = pending?.options?.some(option => option.cardCode === '01023') || false
console.log('DODGE OFFERED?', offered)
