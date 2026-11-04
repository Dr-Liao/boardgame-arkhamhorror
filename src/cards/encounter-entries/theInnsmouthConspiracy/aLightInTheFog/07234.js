// 07234 浪潮汹涌（The Tide Rises）· 密谋 3 · 雾中之光 第六章
//
// 印刷要点：
//   · 正面：同一行的地点互相连接（章节 late-setup 已 map.configure({adjacency:'row'})，
//     对整章持续生效，本卡不重复声明连接规则）。
//   · 背面（推进时）：
//     1) 查找所有场外区域，找出奥赛罗思·马什（07253），将其生成在沉没岩洞（浅层）07244；
//     2) 将每个[[猎鹰岬]]地点移出游戏（若其有胜利 X 且没有线索，则改为加入胜利区）：
//        先把这些地点上的所有敌人和调查员移动到 07244，弃掉这些地点的其他卡牌；
//     3) 在可以提升淹没等级的地点中，找到最底下 4 个，提升它们的淹没等级。
//
// 引擎读点：
//   · agendaRule.onReveal ← content entry-rules.agendaReveal（advanceAgenda 推进到本密谋时调用）。
//   · 场外找马什：api.takeFromSetAside / api.takeFromVictory / api.takeEncounterDeckCard /
//     api.takeEncounterDiscard（分别覆盖 放到一边 / 胜利区 / 遭遇牌库 / 遭遇弃牌堆），再 api.spawn；
//     若他已在场则 api.moveEnemy 移到 07244（避免参考实现「重复生成」的隐患）。
//   · 猎鹰岬地点：hasTrait(location,'Falcon Point')（章节数据 traits 来自印刷卡面）。
//   · 移动占位者：api.moveInvestigator / api.moveEnemy；移除：api.removeLocationFromGame(id,
//     { discardPlayerAttachments:true })（location-swap.js 的剧情入口，地点附属/屏障随 removeLocation 清理）。
//   · 提升淹没：api.mechanics.water.canChange/change（flood.js 阈值与 floodBounds 一致），
//     最底下 = api.mechanics.map.position().y 最小者，同一行多于所需时由队伍领队 api.choice 选；
//     与 07235b 共用 _shared.js#floodBottommostLocations（参考实现 Helpers.hs#floodBottommost）。
//   · 猎鹰岬地点若有 Victory X 且无线索：api.awardLocationVictory（scenario-runtime 已暴露）。
import { floodBottommostLocations, hasTrait, originalOf } from '../../_shared.js'

const MARSH = '07253'
const UPPER_DEPTHS = '07244'
const FALCON_POINT_TRAIT = 'Falcon Point'

function locationByCode(state, code) {
  return state.locations.find(location => String(originalOf(location)) === code) || null
}

function definitionByCode(state, code) {
  return Object.values(state.scenario.locations || {})
    .find(definition => String(definition.originalCode || definition.code) === code) || null
}

// 沉没岩洞（浅层）应已由议程 2b/场景 2b 揭示入场；防御性补齐时按主线图示 (2,-1) 放置并揭示，
// 避免「必须进入 07244」的移动被未揭示面的蓝钥匙限制卡死。
function ensureUpperDepthsInPlay(state, api) {
  const existing = locationByCode(state, UPPER_DEPTHS)
  if (existing) return existing
  const definition = definitionByCode(state, UPPER_DEPTHS)
  if (!definition) return null
  api.mechanics.map.place(definition.id, 2, -1)
  const placed = locationByCode(state, UPPER_DEPTHS)
  if (placed && !placed.revealed) api.reveal(placed.id)
  return placed
}

function takeOutOfPlayMarsh(state, api) {
  if (api.takeFromSetAside(MARSH)) return true
  if (api.takeFromVictory(MARSH)) return true
  if (api.takeEncounterDeckCard(MARSH)) return true
  if (api.takeEncounterDiscard(MARSH)) return true
  return false
}

function bringMarshTo(state, api, destination) {
  const inPlay = state.enemies.find(enemy => !enemy.defeated && !enemy.removedFromGame
    && String(originalOf(enemy)) === MARSH)
  if (inPlay) {
    api.moveEnemy(inPlay, destination.id)
    return inPlay
  }
  takeOutOfPlayMarsh(state, api)
  return api.spawn(MARSH, destination.id)
}

// 找到「最底下」的可提升淹没等级的地点并提升 4 次：按行从最底层往上，每行最多提升完一行
// 才进入下一行；同一行多于所需时由队伍领队选择具体地点。口径与 07235b 共用（_shared.js）。

export default {
  code: '07234', scope: 'agenda', implemented: true,
  agendaRule: {
    onReveal(state, agenda, api) {
      const upper = ensureUpperDepthsInPlay(state, api)
      if (!upper) {
        api.info?.('⚠️ 沉没岩洞（浅层）不在场，浪潮汹涌的搬运/淹没结算无法继续。')
        return
      }
      bringMarshTo(state, api, upper)
      const falconPoint = state.locations.filter(location => hasTrait(location, FALCON_POINT_TRAIT))
      for (const inv of state.investigators) {
        if (inv.defeated || inv.resigned) continue
        if (falconPoint.some(location => location.id === inv.location)) api.moveInvestigator(inv.seat, upper.id)
      }
      for (const enemy of state.enemies) {
        if (enemy.defeated || enemy.removedFromGame) continue
        if (falconPoint.some(location => location.id === enemy.location)) api.moveEnemy(enemy, upper.id)
      }
      for (const location of falconPoint) {
        const victoryPoints = Number(location.victory) || 0
        if (victoryPoints > 0 && (location.clues || 0) === 0) api.awardLocationVictory(location.id)
        api.removeLocationFromGame(location.id, { discardPlayerAttachments: true })
      }
      const flooded = floodBottommostLocations(state, api, 4, '07234')
      api.info?.(`🌊 「浪潮汹涌」：提升最底下 ${flooded} 个地点的淹没等级。`)
    },
  },
}
