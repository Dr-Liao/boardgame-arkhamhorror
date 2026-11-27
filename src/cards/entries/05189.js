// 05189 秘密卷轴（神秘学家 · 3 经验）
// 卡面：使用(4秘密)。
// 卡面：[action]横置秘密卷轴并花费1秘密：查看任意一位调查员的牌库顶或牌库底1张卡牌，或遭遇牌库顶
//       或牌库底1张卡牌。然后，弃掉该卡牌、将其加入其所有者手牌，或将其放到该牌库底或者牌库顶。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05189 秘密卷轴（神秘学家）：[行动]花 1 秘密并横置：看任意牌库的顶或底 1 张，然后弃/拿/放顶/放底。
//
import { chooseDeckToInspect, placeInspectedDeckCard, takeInspectedDeckCard } from './_shared.js'

export default {
  code: '05189',
  uses: 4,
  usesType: 'secrets',
  abilities: [
    {
      kind: 'action',
      label: '横置并花 1 秘密：查看任意牌库顶或底 1 张，然后弃/拿/放顶/放底',
      cost: { exhaust: true, uses: 1 },
      resolve: ({ state, inv, api }) => {
        const zone = chooseDeckToInspect(state, inv, api, '05189', '选择要查看的牌库。')
        if (!zone) { api.info('没有可以查看的牌库。'); return }
        const single = zone.cards.length === 1
        const end = single ? 'top' : api.choice({
          kind: 'effect', source: '05189', seat: inv.seat,
          prompt: '查看该牌库的哪一端？',
          options: [{ id: 'top', label: '牌库顶' }, { id: 'bottom', label: '牌库底' }],
        })
        const code = takeInspectedDeckCard(api, zone, end)
        if (code == null) { api.info('所选牌库是空的。'); return }
        api.info(`👁 ${inv.name} 查看「${zone.label}」${end === 'bottom' ? '底' : '顶'}的「${api.cardName(code)}」。`)
        const destinations = [
          { id: 'discard', label: '弃掉该卡牌' },
          ...(zone.seat != null ? [{ id: 'hand', label: '加入其所有者手牌' }] : []),
          { id: 'bottom', label: '放到该牌库底' },
          { id: 'top', label: '放到该牌库顶' },
        ]
        const destination = api.choice({
          kind: 'effect', source: '05189', seat: inv.seat,
          prompt: '选择该卡牌的去向。', options: destinations,
        })
        placeInspectedDeckCard(api, zone, code, destination)
        if (destination === 'discard') api.info(`🃏 「${api.cardName(code)}」被弃掉。`)
        else if (destination === 'hand') api.info(`✋ 「${api.cardName(code)}」加入 ${state.investigators[zone.seat].name} 的手牌。`)
        else api.info(`📚 「${api.cardName(code)}」放到「${zone.label}」${destination === 'bottom' ? '底' : '顶'}。`)
      },
    },
  ],
}
