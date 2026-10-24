// 05111 情报报告
// 卡面：发现你所在地点的1个线索。
// 卡面：[reaction]在你打出情报报告时，提升其费用2点：“发现……的1个线索”变为“发现……的2个线索”。
// 卡面：[reaction]在你打出情报报告时，提升其费用2点：“你所在地点”变为“与你所在地点之间连接次数不超过2的地点”。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// P7：两个「打出时提升费用」的反应在 played 的 resolve 里逐项询问（资源足够时才询问），
// 额外费用用 api.loseResources 支付；第二项把发现目标改到 2 连接内的地点（BFS 读地点连线）。

const DESTINATION_UPGRADE_COST = 2

function locationsWithin(state, originId, maxSteps) {
  const byId = new Map(state.locations.map(location => [location.id, location]))
  const seen = new Set([originId])
  let frontier = [originId]
  const found = []
  for (let step = 0; step < maxSteps; step++) {
    const next = []
    for (const id of frontier) {
      for (const connected of byId.get(id)?.connections || []) {
        if (seen.has(connected) || !byId.has(connected)) continue
        seen.add(connected)
        found.push(connected)
        next.push(connected)
      }
    }
    frontier = next
  }
  return found
}

export default {
  code: '05111',
  abilities: [
    {
      kind: 'played', label: '情报报告：发现线索（可花 2 资源升级次数/范围）',
      resolve: ({ state, inv, api }) => {
        let budget = inv.resources
        const upgrades = []
        const upgradeOptions = [
          { id: 'clues', label: '再花 2 资源：改为发现 2 个线索' },
          { id: 'range', label: '再花 2 资源：改为与你连接次数不超过 2 的地点' },
        ]
        for (const upgrade of upgradeOptions) {
          if (budget < DESTINATION_UPGRADE_COST) break
          const answer = api.choice({ kind: 'effect', source: '05111', seat: inv.seat, canSkip: true,
            prompt: `情报报告：是否提升费用 2 点（${upgrade.label}）？剩余资源 ${budget}。`,
            options: [{ id: 'skip', label: '不提升' }, { id: upgrade.id, label: upgrade.label }] })
          if (answer === upgrade.id) {
            api.loseResources(inv.seat, DESTINATION_UPGRADE_COST)
            budget -= DESTINATION_UPGRADE_COST
            upgrades.push(upgrade.id)
          }
        }
        let locationId = inv.location
        if (upgrades.includes('range')) {
          const destinations = locationsWithin(state, inv.location, 2)
          if (destinations.length) {
            locationId = destinations.length === 1 ? destinations[0]
              : api.choice({ kind: 'location', source: '05111', seat: inv.seat,
                prompt: '情报报告：选择发现线索的地点（与你所在地点连接次数不超过 2）。',
                options: destinations.map(id => ({ id, label: api.locName(id) })) })
          }
        }
        const amount = upgrades.includes('clues') ? 2 : 1
        api.discoverClue(inv.seat, amount, locationId)
        api.info(`情报报告：「${api.locName(locationId)}」发现 ${amount} 个线索。`)
      },
    },
  ],
  modifiers: [],
}
