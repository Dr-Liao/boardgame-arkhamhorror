// 07316 深海之城（版本一）（City of the Deep (v. I)）· 幕 2 · 暗潮之下 第八章
//
// 印刷（中文）：
//   [快速] 从你所在地点的一个[[古神]]敌人上移除1[每调查员]点伤害，或在一个[[巢穴]]地点的
//          调查员共同花费1[每调查员]个线索：降低场上任意一个非[[圣堂]]地点的淹没等级。
//   目标 - 要阻止深潜者的仪式，你得抽干整座城市。如果场上每个地点都未淹没，推进。
//
// 印刷（English）：
//   [fast] Either remove 1 [per_investigator] damage from an [[Ancient One]] enemy at your
//          location, or investigators at a [[Lair]] location spend 1 [per_investigator] clues,
//          as a group: Decrease the flood level of any non-[[Sanctum]] location in play.
//   Objective - Stop the Deep Ones' ritual by draining the city. If each location in play is
//               unflooded, advance.
//
// 印刷（背面，三张「深海之城」同文）：
//   将本卡牌加入胜利区。
//   - 如果场上有另一张场景卡牌，你可以选择继续游戏，以完成该场景卡牌上的目标；或者不完成该
//     目标，立即进入(→结局1)。
//   - 如果场上没有其他场景卡牌，进入(→结局1)。
//   胜利2。
//
// 模板位置（一卡一文件）：
//   src/cards/encounter-entries/theInnsmouthConspiracy/intoTheMaelstrom/07316.js
//
// 引擎读点：
//   · 目标：act-agenda.js#checkAct 读条目 `actRule.objective`（TIC 内容层没有 checkObjectives）；
//     07316 在线性幕组（state.acts[1]），满足即 advanceAct（打印的「推进」）。
//   · 背面：content entry-rules.actReveal → 本文件 `actRule.onReveal`。其中
//     `api.addCurrentActToVictory()` 把本卡加入胜利区（Victory 2）；
//     `api.resolveActCompletion({ act })` 是并行幕（parallel-acts.js）的统一完成结算：
//     场上没有其他场景卡 → 立即 finish('resolution1')；还有另一张场景卡 → 队长选择「继续/立即R1」。
//   · [快速] 二选一能力：分别写成两条 `kind:'free', actionKind:'activate', range:'anywhere'`
//     （幕实体没有地点，range 必须 anywhere；条件用 criteria 收窄到「你所在地点」）。
//     读点：parley.js#activeStageEntities → parleyMovesFor → legalMoves 的 entityAbility
//     → ability-exec#doEntityAbility（费用/日志/结算与其它实体能力同一管线）。
//     或费用 `cost.groupClues`（本地点团队线索，默认 scope='here'）由 ability-rules#canAffordAbility/
//     payAbilityCost 读；淹没读写走 api.mechanics.water（flood.js，0 未淹没 / 1 部分 / 2 完全）。
//   · 「移除伤害」走 api.healEnemy（api-misc：只写 damageTaken，不触发击败/胜利结算）。
//
// 与印刷的差异（无）：
//   · 「[快速]」= kind:'free'；两条能力同来源、各自独立出现在合法行动里（不引入 OrCost）。
//   · 「降低任意一个非[[圣堂]]地点」的「任意」由施术调查员选择（api.choice kind:'location'）。
//
// implemented: true

import { floodLevel, hasTrait } from '../../_shared.js'

const LAIR_TRAIT = 'Lair'
const ANCIENT_ONE_TRAIT = 'Ancient One'
const SANCTUM_TRAIT = 'Sanctum'

const ancientOnesAt = (state, locationId) => (state.enemies || []).filter(enemy =>
  !enemy.defeated && !enemy.removedFromGame
  && enemy.location === locationId && hasTrait(enemy, ANCIENT_ONE_TRAIT))

const locationByEntity = (state, locationId) => (state.locations || []).find(location => location.id === locationId) || null

// 可被降低淹没等级的地点：场上、已淹没、非[[圣堂]]。
const drainableLocations = state => (state.locations || []).filter(location =>
  floodLevel(state, location.id) > 0 && !hasTrait(location, SANCTUM_TRAIT))

export default {
  code: '07316', scope: 'act', implemented: true,
  actRule: {
    objective(state) {
      if (!(state.locations || []).length) return false
      return state.locations.every(location => floodLevel(state, location.id) === 0)
    },
    // 线性幕组的完成入口（advanceAct → runActReveal → content actReveal → 这里）。
    onReveal(state, act, api) {
      api.addCurrentActToVictory()
      api.resolveActCompletion({ act, resolution: 'resolution1' })
    },
    // 同一张卡若以「额外活动幕」形态入场（flashback 的 alternate objective 方案），
    // 完成入口是 checkAct 的并行幕分派；背面同文，逻辑与 onReveal 完全一致。
    onComplete(state, act, api) {
      api.completeParallelAct(act.id)
      api.resolveActCompletion({ act, resolution: 'resolution1' })
    },
  },
  abilities: [{
    // 选项 A：从你所在地点的一个[[古神]]敌人上移除 1[每调查员]点伤害。
    kind: 'free', actionKind: 'activate', range: 'anywhere',
    label: '从你所在地点的一个[[古神]]敌人上移除1[每调查员]点伤害',
    criteria: ({ state, inv }) => ancientOnesAt(state, inv.location).length > 0,
    resolve: ({ state, inv, api }) => {
      const enemies = ancientOnesAt(state, inv.location)
      if (!enemies.length) return
      const id = enemies.length === 1 ? enemies[0].id : api.choice({
        kind: 'enemy', source: '07316', seat: inv.seat,
        prompt: '选择要移除伤害的[[古神]]敌人。',
        options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = enemies.find(item => item.id === id)
      if (!enemy) return
      api.healEnemy(enemy, state.numInvestigators)
      api.info?.(`🌊 从「${enemy.name}」上移除 ${state.numInvestigators} 点伤害。`)
    },
  }, {
    // 选项 B：在[[巢穴]]地点的调查员共同花费 1[每调查员]个线索：降低任意非[[圣堂]]地点的淹没等级 1。
    kind: 'free', actionKind: 'activate', range: 'anywhere',
    label: '在[[巢穴]]地点共同花费1[每调查员]个线索：降低任意非[[圣堂]]地点的淹没等级',
    groupClueScope: 'here',
    criteria: ({ state, inv }) => {
      const location = locationByEntity(state, inv.location)
      if (!location || !hasTrait(location, LAIR_TRAIT)) return false
      return drainableLocations(state).length > 0
    },
    cost: { groupClues: ({ state }) => state.numInvestigators },
    resolve: ({ state, inv, api }) => {
      const candidates = drainableLocations(state)
      if (!candidates.length) return
      const id = candidates.length === 1 ? candidates[0].id : api.choice({
        kind: 'location', source: '07316', seat: inv.seat,
        prompt: '选择要降低淹没等级的非[[圣堂]]地点。',
        options: candidates.map(location => ({ id: location.id, label: location.name })),
      })
      const location = candidates.find(item => item.id === id)
      if (!location) return
      api.mechanics.water.change(location.id, -1)
      api.info?.(`🌊 「${location.name}」的淹没等级降低 1（当前 ${floodLevel(state, location.id)}）。`)
    },
  }],
}
