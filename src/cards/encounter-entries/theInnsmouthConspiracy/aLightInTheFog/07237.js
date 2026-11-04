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
//   · 地图扩张 + 惨遭俘虏洗入 = _shared.js#expandSunkenGrotto（与 07233b 共用同一句印刷块，
//     只实现一次）；扩张内部的放置/揭示读 api.mechanics.map / api.reveal，07244 的符号
//     （squiggle↔equals/square/t）由 locations.js#linkLocationBySymbols / 动态符号同步自动连到
//     灯塔梯井与沉没岩洞；同行连接由章节 map.configure({adjacency:'row'}) 全局负责。
//   · api.addEnemyToVictory(07253)（scenarioRuntime 顶层的 banishEnemyToVictory 剧情入口，forceVictory）。
//   · 「直接推进到 3a（不结算 2b）」走 P7 新读点 api.scenario.advanceAgendaTo(index)
//     （act-agenda.js：不调用 runAgendaReveal、不清场上的毁灭）。
import { expandSunkenGrotto, originalOf } from '../../_shared.js'

const MARSH = '07253'
const UPPER_DEPTHS = '07244'
const NEXT_AGENDA = '07234' // agenda 3a：浪潮汹涌

function locationByCode(state, code) {
  return state.locations.find(location => String(originalOf(location)) === code) || null
}

// P7 读点：api.scenario.advanceAgendaTo(index) —— 跳过当前密谋背面、直接推进到目标议程正面
//（act-agenda.js 实现；不调用 runAgendaReveal、不清场上的毁灭）。两种 api 面都探测。
function advanceAgendaDirectly(state, api, code) {
  const index = (state.agendas || []).findIndex(agenda => String(originalOf(agenda)) === code)
  if (index < 0) return false
  const runtime = api.scenario || api
  return runtime.advanceAgendaTo(index) === true
}

export default {
  code: '07237', scope: 'act', implemented: true,
  actRule: {
    objective(state) {
      const basement = locationByCode(state, UPPER_DEPTHS)
      if (!basement) return false
      return state.investigators.some(inv => !inv.defeated && !inv.resigned && inv.location === basement.id)
    },
    onReveal(state, act, api) {
      const marsh = state.enemies.find(enemy => !enemy.defeated && !enemy.removedFromGame
        && String(originalOf(enemy)) === MARSH)
      if (marsh) api.addEnemyToVictory(marsh)
      const expansion = expandSunkenGrotto(state, api)
      if (!expansion.upper) api.info?.('⚠️ 沉没岩洞（浅层）不在场，扩张结算不完整。')
      // 三行各 3 个空位（固定地点占中列）共 9 个；本 setup 的潮水通道池正好 9 张。
      if (expansion.tunnelCount < 9) api.info?.(`⚠️ 潮水通道只放入 ${expansion.tunnelCount} 个（应为 9 个空位全放满）。`)
      advanceAgendaDirectly(state, api, NEXT_AGENDA)
    },
  },
}
