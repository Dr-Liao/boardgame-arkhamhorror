// 07046 逃出生天（The Pit of Despair 第一章幕 1）
//
// 印刷（中文）：
//   目标 - 如果所有幸存的调查员都撤退，推进场景。
//   背面（推进时）：(→R1)。
// 印刷（英文）：
//   Objective - If all surviving investigators have resigned, advance the scenario.
//   Back: (→R1)
//
// 引擎读点：
//   · actRule.objective 与 actRule.allResigned 共用同一个「全员撤退」判定：
//     allResigned 由引擎 doResign 在**最后一名**调查员撤退时先结算；缺失它时引擎
//     checkOutcome 会抢先落到 noResolution，背面结局键退化成 noResolution（审计 H7；
//     与 07238 同款钩子）。
//   · onReveal → api.finish('resolution1')。
//   · abilities：地点被揭示后在下方/左侧/右侧空位放置潮汐隧道（api.map.expand）。
import { gridPosition } from '../../_shared.js'

const offsets = [{ x: 0, y: -1 }, { x: -1, y: 0 }, { x: 1, y: 0 }]
const allSurvivorsResigned = state => state.investigators.some(inv => !inv.defeated)
  && state.investigators.every(inv => inv.defeated || inv.resigned)

export default {
  code: '07046', scope: 'act', implemented: true,
  actRule: {
    objective: allSurvivorsResigned,
    allResigned(state, act, api) {
      if (!allSurvivorsResigned(state)) return false
      api.advanceAct()
      return true
    },
    onReveal: (state, act, api) => api.finish('resolution1'),
  },
  abilities: [{
    kind: 'forced', trigger: 'locationRevealed', label: '逃出生天：在下方、左侧和右侧的空位放置潮汐隧道',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ state, context }) => !!gridPosition(state, context.location)
      && (state.scenarioFlags?.mechanics?.scenarioDecks?.tidalTunnels?.deck.length || 0) > 0,
    resolve: ({ context, api }) => api.map.expand(context.location, offsets, 'tidalTunnels'),
  }],
}
