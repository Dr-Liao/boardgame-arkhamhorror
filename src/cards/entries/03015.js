// 03015 怒灵
// 卡面：显现 - 将怒灵放置入场，放到你的威胁区域。
// 卡面：[free]横置一张[[法术]]支援：将该支援上的1充能移动到怒灵上。
// 卡面：强制 - 在游戏结束时，如果怒灵上的充能少于4：你承受1点肉体创伤。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03015 愤怒之灵：作为威胁区的弱点牌（有充能），横置一个「未横置、有充能、法术特性」的支援，
// 移动 1 个充能到自身。弱点数据体与主动能力放在同一个条目里（弱点读点仍是 weaknessProfile）。

export default {
  code: '03015',
  physicalTraumaIfUsesBelow: 4,
  abilities: [
    {
      kind: 'weakness', label: '愤怒之灵（威胁区弱点）',
      weakness: { type: 'threat', initialUses: 0, usesType: 'charges' },
    },
    {
      kind: 'action', label: '横置一个法术支援并移动其 1 个充能到愤怒之灵',
      cost: { action: false },
      resolve: ({ inv, source, api }) => {
        const candidates = inv.assets.filter(card => !card.exhausted && api.isChargeAsset(card)
          && (card.uses || 0) > 0 && api.cardTraits(card.code).includes('spell'))
        if (!candidates.length) return
        const targetId = api.choice({ kind: 'target', source: '03015', seat: inv.seat,
          prompt: '选择并横置一个有充能的法术支援。',
          options: candidates.map(card => ({ id: card.id, label: api.cardName(card.code) })) })
        const card = candidates.find(item => item.id === targetId)
        if (!card) return
        api.exhaust(card)
        api.addUses(card, -1)
        api.addUses(source, 1)
        api.info(`「${api.cardName('03015')}」从「${api.cardName(card.code)}」移动了1个充能（${source?.uses || 0}/4）。`)
      },
    },
  ],
  modifiers: [

  ],
}
