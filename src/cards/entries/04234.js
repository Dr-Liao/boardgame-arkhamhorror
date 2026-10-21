// 04234 献祭贡品
// 卡面：弃掉你控制的一张[mystic]支援卡牌。然后，抽取3张卡牌或获得3资源，或以任何方式组合(卡牌和/或资源的总数为3)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04234 献祭：弃掉一张秘术支援，分配 3 点（抽牌 / 资源）。

export default {
  code: '04234',
  abilities: [
    {
      kind: 'played', label: '献祭',
      resolve: ({ state, inv, api }) => {
        const spells = inv.assets.filter(card => api.cardFactions(card.code).includes('mystic'))
        if (!spells.length) { api.info('没有可献祭的秘术支援。'); return }
        const chosen = spells.length === 1 ? spells[0].id
          : api.choice({ kind: 'target', source: '04234', seat: inv.seat, prompt: '选择要献祭的秘术支援。',
            options: spells.map(card => ({ id: card.id, label: api.cardName(card.code) })) })
        const card = spells.find(item => item.id === chosen) || spells[0]
        api.discardAsset(inv.seat, card)
        const split = api.choice({ kind: 'effect', source: '04234', seat: inv.seat,
          prompt: '分配 3 点：抽牌与资源。',
          options: [
            { id: '3-0', label: '抽 3 张牌' },
            { id: '2-1', label: '抽 2 张牌、获得 1 资源' },
            { id: '1-2', label: '抽 1 张牌、获得 2 资源' },
            { id: '0-3', label: '获得 3 资源' },
          ] })
        const [drawCount, resources] = String(split || '3-0').split('-').map(Number)
        if (drawCount) api.drawCards(inv.seat, drawCount)
        if (resources) api.gainResources(inv.seat, resources)
        api.info(`${inv.name} 献祭「${api.cardName(card.code)}」：抽 ${drawCount} 张、获得 ${resources} 资源。`)
      },
    },
  ],
  modifiers: [

  ],
}
