// 07128 穿越迷宫（In Too Deep 第三章幕 1）
//
// 印刷（中文）：
//   目标 - 如果所有幸存的调查员都撤退，推进场景。
//   背面（推进时）：记录「调查员们安全抵达了他们的载具」（本战役的奖励记录），(→R1)。
// 印刷（英文）：
//   Objective - If all surviving investigators have resigned, advance the scenario.
//   Back: Record in the Campaign Log "The investigators made it safely to their vehicles." (→R1)
//
// 引擎读点：
//   · actRule.objective 与 actRule.allResigned 共用同一个「全员撤退」判定：
//     objective 在每次行动后由 act-agenda.js#checkAct 读；allResigned 由引擎 doResign
//     在**最后一名**调查员撤退时先结算（否则引擎 checkOutcome 会抢先落到 noResolution，
//     背面记录 + R1 + 2 XP 全部丢失）。同一战役 07238 有同款钩子。
//   · 背面：api.setCampaignRecord 写记录 + api.finish('resolution1')；content resolutions.js
//     的 inTooDeep 分支按 TheInvestigatorsMadeItSafelyToTheirVehicles 给 2 XP。
//   · abilities：全队花费「调查员人数+1」线索移除一道屏障（团队线索、任意地点范围）。
import { barrierEdges } from '../../_shared.js'

const allSurvivorsResigned = state => state.investigators.some(inv => !inv.defeated)
  && state.investigators.every(inv => inv.defeated || inv.resigned)

export default {
  code: '07128', scope: 'act', implemented: true,
  actRule: {
    objective: allSurvivorsResigned,
    allResigned(state, act, api) {
      if (!allSurvivorsResigned(state)) return false
      api.advanceAct()
      return true
    },
    onReveal(state, act, api) {
      api.setCampaignRecord('TheInvestigatorsMadeItSafelyToTheirVehicles', true)
      api.finish('resolution1')
    },
  },
  abilities: [{
    kind: 'free', actionKind: 'activate', range: 'anywhere', groupClueScope: 'anywhere',
    label: '全队花费调查员人数+1线索：移除你所在地点的一道屏障',
    cost: { groupClues: ({ state }) => state.numInvestigators + 1 },
    criteria: ({ state, inv }) => barrierEdges(state, inv.location).some(edge => edge.count > 0),
    resolve: ({ inv, api }) => api.barriers.removeConnected(inv.seat, inv.location),
  }],
}
