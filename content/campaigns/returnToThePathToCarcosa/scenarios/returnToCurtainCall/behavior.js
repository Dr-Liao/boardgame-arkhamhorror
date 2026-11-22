// 重返谢幕 · 章节行为。
//
// 基础章节的完整规则（幕/密谋揭示、混乱标记、门道行动、结局记录……）直接复用
// `content/campaigns/thePathToCarcosa/scenarios/curtainCall/behavior.js`，这里只覆盖
// 重返盒的差异：
//   1. 幕牌库随机从 6 张「场景 2a·陌生人」中选 1 张（基础 3 张 + 52015–52017）；
//   2. 前厅/后台门道加入剧院休息室（52018）与道具间（52019）；
//   3. 皇家密使加入胜利区后按提示卡（52014 背面）累积警告，每点警告 +1 生命；
//   4. 52015–52017 背面的「不弃掉苍白面具下的男子」结算（基础 03047a–c 的
//      等价效果由 encounter-entries 的 applyStrangerBack 实现；重返三张的背面文本
//      不同，且把敌人重新放回场上必须写场景运行状态，故在本章行为内结算）。
import { behavior as baseBehavior } from '../../../thePathToCarcosa/scenarios/curtainCall/behavior.js'
import { nonPlayerEntryFor } from '../../../../../src/cards/encounter-abilities.js'
import { actRuleFor, entryFlags } from '../../../../../src/cards/card-rules.js'
import { returnToIntroduction } from '../../story.js'
import { STRANGER_ACT_CODES } from './definition.js'

const STRANGER_ACTS = new Set(STRANGER_ACT_CODES)
const original = card => card?.originalCode || card?.code
const ACTIVE_ACT_TWO = STRANGER_ACTS

// 52015–52017 背面的差异：加哪些混乱标记、哪个地点 +1 恐惧、本场危险名。
const RETURN_STRANGER_BACKS = Object.freeze({
  '52015': { tokens: ['cultist', 'tablet'], horror: 'backstage', hazard: 'returnMists' },
  '52016': { tokens: ['cultist', 'elderthing'], horror: 'balcony', hazard: 'returnOvergrowth' },
  '52017': { tokens: ['tablet', 'elderthing'], horror: 'lobby', hazard: 'returnScreech' },
})

function removeEngagement(state, enemy) {
  if (enemy.engagedSeat != null) {
    const inv = state.investigators[enemy.engagedSeat]
    if (inv) inv.engaged = (inv.engaged || []).filter(id => id !== enemy.id)
  }
  enemy.engagedSeat = null
}

// 把「苍白面具下的男子」收回场上并移到前厅（他已被 defeatEnemy/discardEnemyCard 移出）。
function movePallidMaskToLobby(state, enemy, api) {
  if (!enemy) return
  for (const pile of [state.encounterDiscard, state.investigators?.[enemy.bearerSeat]?.discard]) {
    if (!pile) continue
    const index = pile.lastIndexOf(enemy.code)
    if (index >= 0) pile.splice(index, 1)
  }
  state.enemies ||= []
  if (!state.enemies.includes(enemy)) state.enemies.push(enemy)
  removeEngagement(state, enemy)
  enemy.location = 'lobby'
  enemy.damageTaken = 0
  enemy.exhausted = false
  delete enemy.defeatedBy
  api.info?.('🛋️ 苍白面具下的男子没有被弃掉：他被移动到「前厅」并留在场上。')
}

function applyReturnStrangerBack(state, code, enemy, api) {
  movePallidMaskToLobby(state, enemy, api)
  const config = RETURN_STRANGER_BACKS[code]
  if (!config) return
  for (const token of config.tokens) {
    state.chaosBag.push(token)
    if (state.campaign?.chaosBag) state.campaign.chaosBag.push(token)
  }
  const location = state.locations.find(candidate => candidate.id === config.horror)
  if (location) location.horror = (location.horror || 0) + 1
  state.scenarioFlags ||= {}
  state.scenarioFlags.hazard = config.hazard
  api.info?.(`🌫️ 陌生人的背面危险「${config.hazard}」生效：地点上的恐惧开始折磨你们。`)
}

export const behavior = {
  ...baseBehavior,
  id: 'returnToCurtainCall',
  introduction: returnToIntroduction('curtainCall'),

  setupPlan(state) {
    return {
      locations: ['theatre', 'lobby', 'balcony', 'backstage'],
      setAside: [
        '03053', '03054', '03055', '03056', '03057', '03058',
        '03059', '03060', '52018', '52019',
      ],
      removed: [],
    }
  },

  setupLocations(state, events, api) {
    const actTwos = state.scenario.acts.filter(act => ACTIVE_ACT_TWO.has(act.originalCode))
    const selected = api.shuffle([...actTwos], () => api.randomValue(state))[0]
    state.acts = [
      structuredClone(state.scenario.acts.find(act => nonPlayerEntryFor(act.originalCode)?.flags?.firstAct)),
      structuredClone(selected),
      structuredClone(state.scenario.acts.find(act => nonPlayerEntryFor(act.originalCode)?.flags?.escapeAct)),
    ]
    state.scenarioFlags = {
      actTwoCode: selected.originalCode,
      // 重返新增两个门道地点：剧院休息室（前厅侧）与道具间（后台侧）。
      lobbyDoorways: ['lightingBox', 'boxOffice', 'greenRoom', 'theatreLounge'],
      backstageDoorways: ['dressingRoom', 'rehearsalRoom', 'trapRoom', 'propShop'],
      stoleFromBoxOffice: false,
      boxOfficeUsed: false,
      hazardTests: {},
      // 52014 背面：皇家密使每有一个警告得到 +1 生命。首次加入胜利区时 +1。
      royalEmissaryWarnings: 0,
      returnStrangerAct: selected.originalCode,
    }
    for (const inv of state.investigators) {
      if (entryFlags(inv.code)?.backstageStart) inv.location = 'backstage'
    }
    // 与基础章节同口径：若有人开局在后台，随机 2 张后台门道入场。
    const placed = [...this.setupPlan(state).locations]
    if (state.investigators.some(inv => inv.location === 'backstage')) {
      const pool = state.scenarioFlags.backstageDoorways
      for (let count = 0; count < 2 && pool.length; count++) {
        const id = pool.splice(Math.floor(api.randomValue(state) * pool.length), 1)[0]
        if (id) placed.push(id)
      }
    }
    return placed
  },

  enemyStatModifier(state, enemy, stat, inv) {
    // 提示卡附属在皇家密使上：每点警告 +1 生命（「每有一个警告 +1[per_investigator]」）。
    if (stat === 'health' && original(enemy) === '03060') {
      return (Number(state.scenarioFlags?.royalEmissaryWarnings || 0)
        + (baseBehavior.enemyStatModifier?.(state, enemy, stat, inv) || 0))
    }
    return baseBehavior.enemyStatModifier?.(state, enemy, stat, inv) || 0
  },

  enemyDefeated(state, enemy, api) {
    const code = original(enemy)
    // 皇家密使加入胜利区后累积 1 个警告（52014 背面）。
    if (code === '03060') {
      state.scenarioFlags.royalEmissaryWarnings = Number(state.scenarioFlags.royalEmissaryWarnings || 0) + 1
      return baseBehavior.enemyDefeated(state, enemy, api)
    }
    if (code !== '03059') return baseBehavior.enemyDefeated(state, enemy, api)
    const actCode = original(state.acts[state.actIndex])
    // 基础三张陌生人幕（03047a–c）的背面由各自的单卡条目结算，交回基础行为。
    if (!RETURN_STRANGER_BACKS[actCode]) return baseBehavior.enemyDefeated(state, enemy, api)
    // 三张重返陌生人幕的正面目标一致：苍白面具下的男子将要被弃掉时推进场景。
    applyReturnStrangerBack(state, actCode, enemy, api)
    removeEngagement(state, enemy)
    enemy.location = 'lobby'
    enemy.damageTaken = 0
    enemy.exhausted = false
    api.advanceAct()
    return true
  },

  enemyDiscarded(state, enemy, api) {
    const actCode = original(state.acts[state.actIndex])
    if (original(enemy) === '03059' && RETURN_STRANGER_BACKS[actCode]) {
      applyReturnStrangerBack(state, actCode, enemy, api)
      api.advanceAct()
      return true
    }
    return baseBehavior.enemyDiscarded(state, enemy, api)
  },
}

// 幕背面推进条件：52015–52017 与基础三张一样由敌人弃置触发；这里给行为补一个
// 可读的「当前陌生人版本」访问器，测试与 AI 提示共用。
export function strangerActBack(state) {
  return actRuleFor(original(state.acts?.[state.actIndex]))?.onEmissaryDiscarded ? true : false
}
