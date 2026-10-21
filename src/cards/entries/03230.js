// 03230 急救
// 卡面：使用(4补给)。如果急救没有补给，将其弃掉。
// 卡面：[action]花费1补给：治愈你所在地点的一位调查员或一个[[盟友]]支援1点伤害和1点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03230 急救：治疗同地点一名调查员或盟友最多 1 点伤害与 1 点恐惧。

export default {
  code: '03230',
  uses: 4,
  usesType: 'supplies',
  discardWhenEmpty: true,
  abilities: [
    {
      kind: 'action', label: '急救治疗伤害和恐惧', cost: { action: true, uses: 1 },
      resolve: ({ state, inv, api }) => {
        const targets = api.investigatorsAt(inv.location)
        const allies = targets.flatMap(owner => (state.investigators[owner.seat]?.assets || [])
          .filter(card => api.cardTraits(card.code).some(trait => String(trait).toLowerCase() === 'ally')))
        const options = [
          ...targets.map(owner => ({ id: 'inv:' + owner.seat, label: owner.name })),
          ...allies.map(card => ({ id: 'asset:' + card.id, label: api.cardName(card.code) })),
        ]
        if (!options.length) return
        const answer = options.length === 1 ? options[0].id
          : api.choice({ kind: 'target', source: '03230', seat: inv.seat,
            prompt: '选择治疗目标（调查员或盟友资产）。', options })
        if (String(answer).startsWith('asset:')) {
          const card = allies.find(item => 'asset:' + item.id === answer)
          if (card) api.healAsset(card, { damage: 1, horror: 1 })
          return
        }
        const seat = Number(String(answer).slice(4))
        api.healDamage(seat, 1)
        api.healHorror(seat, 1)
      },
    },
  ],
  modifiers: [

  ],
}
