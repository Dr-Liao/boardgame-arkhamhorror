// 07237 寻找前路（Finding the Path）· 场景 2 · 雾中之光 第六章
//
// 印刷要点：
//   · 正面：目标 - 如果在密谋推进前，有调查员进入了灯塔地下室（07244 未揭示面名），推进场景。
//   · 背面（推进时）：如果奥赛罗思·马什在场上，将他加入胜利区；
//     把沉没岩洞（深层）放在（浅层）正下方、把（底层）放在（深层）正下方；再把随机放在一边的
//     潮水通道地点放入场，直到每一行（灯光室所在行除外）正好 4 个地点；
//     把每张放在一边的「惨遭俘虏」洗入遭遇牌库；直接推进密谋到 3a（不结算 2b）。
//
// 引擎读点：
//   · actRule.objective(state) ← act-agenda.js#checkAct（每次行动结算后调用；TIC behavior 没有
//     checkObjectives，因此走条目函数分支并自动 advanceAct）。判定=任一未败退调查员位于 07244。
//   · api.reveal / api.mechanics.map.position/place/locations（放置与行数统计）；
//     07244 的符号（squiggle↔equals/square/t）由 locations.js#linkLocationBySymbols / 动态符号同步
//     自动连到灯塔梯井与沉没岩洞；同行连接由章节 map.configure({adjacency:'row'}) 全局负责。
//   · api.addEnemyToVictory(07253)（scenarioRuntime 顶层的 banishEnemyToVictory 剧情入口，forceVictory）。
//   · api.takeFromSetAside('07260') ×N + api.shuffleIntoEncounterDeck → 遭遇牌库。
//   · 「直接推进到 3a（不结算 2b）」走 P7 新读点 api.scenario.advanceAgendaTo(index)
//     （act-agenda.js：不调用 runAgendaReveal、不清场上的毁灭）。
import { originalOf } from '../../_shared.js'

const MARSH = '07253'
const UPPER_DEPTHS = '07244'
const LOWER_DEPTHS = '07245'
const FINAL_DEPTHS = '07246'
const TAKEN_CAPTIVE = '07260'
const NEXT_AGENDA = '07234' // agenda 3a：浪潮汹涌
// 放在一边的「潮水通道」实体：07247–07251（未揭示面 Tidal Tunnel）与 07102/07103 各两张。
const TIDAL_TUNNEL_CODES = ['07247', '07248', '07249', '07250', '07251', '07102', '07103']

function locationByCode(state, code) {
  return state.locations.find(location => String(originalOf(location)) === code) || null
}

function definitionByCode(state, code) {
  return Object.values(state.scenario.locations || {})
    .find(definition => String(definition.originalCode || definition.code) === code) || null
}

function placeLocationAt(state, api, code, x, y) {
  const existing = locationByCode(state, code)
  if (existing) return existing
  const definition = definitionByCode(state, code)
  if (!definition) return null
  if (api.mechanics.map.locations({ row: y, column: x }).length) return null
  api.mechanics.map.place(definition.id, x, y)
  return locationByCode(state, code)
}

function placeBelow(state, api, code, anchor, fallbackPosition) {
  if (!anchor) return placeLocationAt(state, api, code, fallbackPosition.x, fallbackPosition.y)
  const at = api.mechanics.map.position(anchor.id)
  if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.y)) {
    return placeLocationAt(state, api, code, fallbackPosition.x, fallbackPosition.y)
  }
  const existing = locationByCode(state, code)
  if (existing) return existing
  const definition = definitionByCode(state, code)
  if (!definition) return null
  if (api.mechanics.map.locations({ row: at.y - 1, column: at.x }).length) return null
  api.mechanics.map.place(definition.id, at.x, at.y - 1)
  return locationByCode(state, code)
}

// P7 读点：api.scenario.advanceAgendaTo(index) —— 跳过当前密谋背面、直接推进到目标议程正面
//（act-agenda.js 实现；不调用 runAgendaReveal、不清场上的毁灭）。两种 api 面都探测。
function advanceAgendaDirectly(state, api, code) {
  const index = (state.agendas || []).findIndex(agenda => String(originalOf(agenda)) === code)
  if (index < 0) return false
  const runtime = api.scenario || api
  return runtime.advanceAgendaTo(index) === true
}

function spreadTidalTunnels(state, api, anchor) {
  const at = anchor && api.mechanics.map.position(anchor.id)
  if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.y)) return 0
  const inPlay = new Set(state.locations.map(location => location.id))
  const available = Object.values(state.scenario.locations || {})
    .filter(definition => TIDAL_TUNNEL_CODES.includes(String(definition.originalCode || definition.code))
      && !inPlay.has(definition.id))
    .map(definition => definition.id)
  if (!available.length) return 0
  const shuffled = api.shuffle([...available])
  // 主线图示：上层行 / 深层行 / 底层行各 3 个空位（固定地点占中列），逐行放满到每行 4 个。
  const slots = []
  for (const dy of [0, -1, -2]) for (const dx of [-2, -1, 1]) slots.push({ x: at.x + dx, y: at.y + dy })
  let placed = 0
  let cursor = 0
  for (const slot of slots) {
    if (cursor >= shuffled.length) break
    const rowCount = api.mechanics.map.locations({ row: slot.y }).length
    if (rowCount >= 4) continue
    if (api.mechanics.map.locations({ row: slot.y, column: slot.x }).length) continue
    api.mechanics.map.place(shuffled[cursor], slot.x, slot.y)
    cursor += 1
    placed += 1
  }
  return placed
}

export default {
  code: '07237', scope: 'act', implemented: true,
  actRule: {
    objective(state) {
      const basement = state.locations.find(location => String(originalOf(location)) === UPPER_DEPTHS)
      if (!basement) return false
      return state.investigators.some(inv => !inv.defeated && !inv.resigned && inv.location === basement.id)
    },
    onReveal(state, act, api) {
      const marsh = state.enemies.find(enemy => !enemy.defeated && !enemy.removedFromGame
        && String(originalOf(enemy)) === MARSH)
      if (marsh) api.addEnemyToVictory(marsh)
      let upper = locationByCode(state, UPPER_DEPTHS)
      if (!upper) {
        placeLocationAt(state, api, UPPER_DEPTHS, 2, -1)
        upper = locationByCode(state, UPPER_DEPTHS)
      }
      if (upper && !upper.revealed) api.reveal(upper.id)
      const lower = placeBelow(state, api, LOWER_DEPTHS, upper, { x: 2, y: -2 })
      placeBelow(state, api, FINAL_DEPTHS, lower, { x: 2, y: -3 })
      const tunnelCount = spreadTidalTunnels(state, api, upper)
      // 三行各 3 个空位（固定地点占中列）共 9 个；本 setup 的潮水通道池正好 9 张。
      if (tunnelCount < 9) api.info?.(`⚠️ 潮水通道只放入 ${tunnelCount} 个（应为 9 个空位全放满）。`)
      const takenCaptive = []
      while (api.takeFromSetAside(TAKEN_CAPTIVE)) takenCaptive.push(TAKEN_CAPTIVE)
      if (takenCaptive.length) api.shuffleIntoEncounterDeck(takenCaptive, { shuffle: false })
      advanceAgendaDirectly(state, api, NEXT_AGENDA)
    },
  },
}
