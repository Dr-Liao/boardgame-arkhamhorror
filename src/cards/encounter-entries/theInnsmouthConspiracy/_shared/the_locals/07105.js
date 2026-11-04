// 07105 印斯茅斯闹事者 · 当地人
//
// 印刷（中文）：
//   生成 - 线索最多的地点。
//   猎手。
//   [action]将你的1个线索放到你所在地点：谈判。横置印斯茅斯闹事者。
//          其在下一个补给阶段期间不重整。本能力可以由连接地点的调查员触发。
//
// 引擎读点：
//   · 「生成 - 线索最多的地点」= 条目级 `spawnMostClues`：读点在 enemies.js#spawnEnemy，
//     与 spawnFarthestFromAll/spawnAncientFirst 同一段；剧本用 api.spawn(ignoreSpawn=true)
//     指定的剧情生成点优先，已揭示地点之间并列时由领队选择。
//   · 谈判：`actionKind: 'parley'` + `cost: { action: 1, clues: 1 }`（费用从调查员身上扣），
//     结算里用 `api.returnClueToLocation` 把那 1 个线索**放到本地点**——两步合起来正是
//     「将你的 1 个线索放到你所在地点」，两个写入口都是既有原语。
//   · `range: 'connecting'`：连接地点的调查员也能触发（entityAbilityInRange 的既有支撑）。
//   · 「下一个补给阶段期间不重整」= `api.scenario.preventEnemyReady`（写 enemy.preventReady，
//     读点是 phases.js 的补给阶段重整判定，与躲避免费的 skipReadyRounds 共用）。

export default {
  code: '07105', scope: 'enemy', implemented: true,
  spawnMostClues: true,
  abilities: [{
    kind: 'action', actionKind: 'parley', range: 'connecting',
    label: '将你的 1 个线索放到你所在地点：横置印斯茅斯闹事者，其下一个补给阶段不重整',
    cost: { action: 1, clues: 1 },
    criteria: ({ inv }) => (inv?.clues || 0) >= 1,
    resolve: ({ state, inv, source, api }) => {
      api.returnClueToLocation(inv.seat, 1)
      api.exhaust(source)
      api.scenario.preventEnemyReady(source, 1)
    },
  }],
}
