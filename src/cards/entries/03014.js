// 03014 灵言者
// 卡面：阿喀琦·奥耶莉牌库专用。
// 卡面：[free]横置灵言者：选择你控制的一张带有“使用(充能)”的支援。将该支援返回你的手牌，或将该支援上的所有充能(作为资源)移动到你的资源池井弃掉该支援。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03014 灵语人：横置，选一个自己控制的充能支援——返回手牌，或把全部充能换成资源后弃置。

export default {
  code: '03014',
  abilities: [
    {
      kind: 'action', label: '横置：选择一个充能支援，将其返回手牌，或把全部充能转为资源并弃置',
      cost: { action: false, exhaust: true },
      resolve: ({ inv, source, api }) => {
        const candidates = inv.assets.filter(card => card.id !== source?.id
          && api.isChargeAsset(card) && api.canLeavePlay(card))
        if (!candidates.length) return
        const targetId = api.choice({ kind: 'target', source: '03014', seat: inv.seat,
          prompt: '选择一个由你控制的充能支援。',
          options: candidates.map(card => ({ id: card.id, label: api.cardName(card.code) })) })
        const card = candidates.find(item => item.id === targetId)
        if (!card) return
        const mode = api.choice({ kind: 'effect', source: '03014', seat: inv.seat,
          prompt: '选择灵语人的结算方式。', options: [
            { id: 'return', label: '将支援返回手牌' },
            { id: 'resources', label: `获得 ${card.uses || 0} 资源并弃置支援` },
          ] })
        if (mode === 'return') {
          api.returnAssetToHand(inv.seat, card)
        } else {
          api.gainResources(inv.seat, card.uses || 0)
          api.discardAsset(inv.seat, card)
        }
        api.info(`「${api.cardName('03014')}」将「${api.cardName(card.code)}」${mode === 'return' ? '返回手牌' : '转化充能并弃置'}。`)
      },
    },
  ],
  modifiers: [

  ],
}
