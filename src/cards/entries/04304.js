// 04304 煤油
// 卡面：使用(3补给)。如果煤油没有补给，将其弃掉。
// 卡面：[action]如果本轮一个敌人在本地点被击败，横置煤油并花费1补给：治愈你所在地点的调查员和[[盟友]]支援总计最多2点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04304 煤油：本地点本轮有敌人被击败后，治疗一名调查员或一件支援最多 2 点恐惧。

export default {
  code: '04304',
  uses: 3,
  usesType: 'supplies',
  discardWhenEmpty: true,
  abilities: [
    {
      kind: 'action', label: '安抚恐惧', cost: { action: true, exhaust: true, uses: 1 },
      resolve: ({ state, inv, api }) => {
        const here = state.locations.find(location => location.id === inv.location)
        if (here?.enemyDefeatedRound !== state.round) { api.info('本地点本轮没有敌人被击败。'); return }
        let remaining = 2
        while (remaining > 0) {
          const investigators = api.investigatorsAt(inv.location).filter(owner => (owner.horror || 0) > 0)
          const allies = api.investigatorsAt(inv.location).flatMap(owner =>
            (owner.assets || []).filter(card => api.cardTraits(card.code).some(trait => String(trait).toLowerCase() === 'ally')
              // 治愈的是「已有恐惧」的盟友支援：0 恐惧时不可选，避免 api.addAssetHorror(-1) 写出负恐惧。
              && (card.horror || 0) > 0))
          const options = [
            ...investigators.map(owner => ({ id: `inv:${owner.seat}`, label: owner.name })),
            ...allies.map(card => ({ id: `asset:${card.id}`, label: api.cardName(card.code) })),
          ]
          if (!options.length) break
          const chosen = options.length === 1 ? options[0].id
            : api.choice({ kind: 'target', source: '04304', seat: inv.seat,
              prompt: `选择要治愈恐惧的目标（还可治疗 ${remaining} 点；仅限调查员与[[盟友]]）。`, options })
          if (String(chosen).startsWith('inv:')) api.healHorror(Number(String(chosen).slice(4)), 1)
          else {
            const card = api.investigatorsAt(inv.location)
              .flatMap(owner => owner.assets || [])
              .find(item => item.id === String(chosen).slice(6))
            if (card) api.addAssetHorror(card, -1)
          }
          remaining -= 1
        }
      },
    },
  ],
  modifiers: [

  ],
}
