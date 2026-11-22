// 60227 寻找答案
// 卡面：调查。如果你成功，不发现你所在地点的1个线索，改为从你所在地点和连接地点发现总计2个线索。(FAQ, v1.9)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60227',
  abilities: [{
    kind: 'played', countsAs: 'investigate',
    label: '调查；成功则改为在所在地点及连接地点分配发现共 2 个线索',
    resolve: ({ inv, api }) => api.investigate(inv.seat, {
      noClueDiscovery: true,
      onInvestigateSuccess: (result, { loc }) => {
        for (let index = 0; index < 2; index++) {
          const candidates = [loc.id, ...loc.connections]
            .filter(id => api.canDiscoverClueAt(inv.seat, id))
          if (!candidates.length) break
          const location = candidates.length === 1 ? candidates[0] : api.choice({
            kind: 'location', source: '60227', seat: inv.seat, prompt: '选择要发现一个线索的地点。',
            options: candidates.map(id => ({ id, label: api.locationName(id) })),
          })
          api.discoverClue(inv.seat, 1, location)
        }
        if (result.clueBonus > 0) api.discoverClue(inv.seat, result.clueBonus, loc.id, { investigation: true })
      },
    }),
  }],
}
