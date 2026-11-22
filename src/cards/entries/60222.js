// 60222 绝密地图集
// 卡面：使用(4秘密)。
// 卡面：[action]花费1秘密：选择一个与你所在地点之间至多有3次连接的已揭示地点。移动到该地点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

function locationInRange(state, from, to) {
  if (from === to) return false
  const visited = new Set([from])
  let frontier = [from]
  for (let distance = 1; distance <= 3; distance++) {
    const next = []
    for (const id of frontier) {
      for (const neighbor of state.locations.find(location => location.id === id)?.connections || []) {
        if (neighbor === to) return true
        if (visited.has(neighbor)) continue
        visited.add(neighbor)
        next.push(neighbor)
      }
    }
    frontier = next
  }
  return false
}

export default {
  code: '60222',
  uses: 4,
  usesType: 'secrets',
  abilities: [{
    kind: 'action', cost: { action: true, uses: 1 },
    label: '花费 1 秘密：移动到最多相隔 3 个连接的一个已揭示地点',
    target: {
      kind: 'location', range: 'anywhere',
      query: ({ state, inv, entity, canMoveTo }) => entity.revealed
        && locationInRange(state, inv.location, entity.id) && canMoveTo(entity.id),
    },
    resolve: ({ inv, target, api }) => {
      if (target) api.moveInvestigator(inv.seat, target.id)
    },
  }],
}
