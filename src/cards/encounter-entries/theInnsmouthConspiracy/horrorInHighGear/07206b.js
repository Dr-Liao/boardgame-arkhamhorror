// 07206b 岔路 · 高度惊魂（地点，道路2）
//
// 印刷（中文）：
//   道路2。
//   强制 - 在岔路被揭示后：如果前方没有下一列，将 1 张道路卡与 1 张「蜿蜒长路」放到下一列。
//   快速 - 团队花费每人 1 个线索：查看任意前方地点的已揭示面。
//
// 引擎读点：
//   · 「道路 N / 揭示后扩路」是十张道路卡的同句规则，按「同句规则只写一次」收在引擎：
//     地点定义数据 `chapter-data.json#locations[].road` 声明 N，locations.js#revealLocation
//     在揭示后调用 `api.mechanics.map.extendRoad(id, N)`（map-graph.js：只在没有下一列时
//     放 1 张道路卡 + (N−1) 张蜿蜒长路）。本文件不再重复实现（审计 H2 的修复口径）。
//   · 「快速 - 团队花费每人 1 个线索：查看任意前方地点的已揭示面」= abilities 的 free 条目：
//     费用与团队线索走 cost.groupClues，查看已揭示面走 api.scenario.peekLocation。
import { locationLookCandidates } from '../../_shared.js'

export default {
  code: '07206b',
  scope: 'location',
  abilities: [{
    kind: 'free',
    actionKind: 'activate',
    cost: { groupClues: ({ state }) => state.numInvestigators },
    label: '本地点团队花费每人1线索：查看任意前方地点的已揭示面',
    target: {
      kind: 'location',
      range: 'anywhere',
      query: ({ state, source, candidate }) => locationLookCandidates(state, {
        aheadOf: source.id, includeRevealed: true,
      }).some(location => location.id === candidate.id),
    },
    resolve: ({ inv, target, api }) => api.scenario.peekLocation(inv.seat, target.id),
  }],
}
