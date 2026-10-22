// 02023 寻找答案
// 卡面：调查。如果你检定成功，不发现你所在地点的1个线索，改为在一个连接地点发现1个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02023',
  abilities: [
    {
      kind: 'played', label: '寻找答案',
      resolve: ({ state, inv, api }) => {
        const loc = state.locations.find(item => item.id === inv.location)
        const targets = (loc?.connections || [])
          .map(id => state.locations.find(item => item.id === id))
          .filter(item => (item?.clues || 0) > 0)
        // 卡面要求「改为在连接地点发现」；连接地点都没有线索时，本次调查不发现任何线索。
        const difficulty = loc.shroud + (loc.shroudMod || 0)
        api.test(inv.seat, 'intellect', difficulty, {
          source: { label: '调查', name: api.cardName('02023'), code: '02023' },
          resolve: result => {
            if (!result.success || !targets.length) return
            const targetId = targets.length === 1 ? targets[0].id : api.choice({
              kind: 'location', source: '02023', seat: inv.seat,
              prompt: '选择一个连接地点发现线索。',
              options: targets.map(item => ({ id: item.id, label: item.name })),
            })
            api.discoverAt(inv.seat, targetId, 1, {
              log: `${inv.name} 从「${targets.find(item => item.id === targetId)?.name || ''}」发现 1 条线索。`,
            })
          },
        })
      },
    },
  ],
  modifiers: [

  ],
}
