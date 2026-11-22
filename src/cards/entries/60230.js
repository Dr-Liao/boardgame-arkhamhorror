// 60230 禁忌之书
// 卡面：研究。(FAQ, v2.0)
// 卡面：[action][action][action][action]横置禁忌之书：你可以移动到一个连接地点。发现你所在地点的1个线索。你每有4张手牌，本能力费用减少1个行动(最低减至[action])。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60230',
  researchRequirement: 'translatedForbiddenTome',
  researchUpgradeFrom: '60210',
  abilities: [{
    kind: 'action', cost: { action: ({ inv }) => Math.max(1, 4 - Math.floor(inv.hand.length / 4)), exhaust: true },
    label: '横置：可以移动到连接地点，然后在所在地点发现 1 线索；每 4 张手牌少花费 1 行动',
    criteria: ({ state, inv, helpers }) => helpers.canDiscoverClueAt(inv.seat, inv.location)
      || state.locations.find(location => location.id === inv.location)?.connections.some(id => helpers.canMoveTo(inv.seat, id)),
    resolve: ({ state, inv, api }) => {
      const neighbors = state.locations.find(location => location.id === inv.location)?.connections || []
      const targets = neighbors.filter(id => api.canMoveTo(inv.seat, id))
      if (targets.length) {
        const destination = api.choice({
          kind: 'location', source: '60230', seat: inv.seat, canSkip: true,
          prompt: '选择连接地点，或留在原地。',
          options: [{ id: 'stay', label: '留在原地' }, ...targets.map(id => ({ id, label: api.locationName(id) }))],
        })
        if (destination !== 'stay') api.moveInvestigator(inv.seat, destination)
      }
      api.discoverClue(inv.seat, 1)
    },
  }],
}
