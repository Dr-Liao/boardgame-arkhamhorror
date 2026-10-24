// 05233 投资（潜袭者 · 0 经验）
// 卡面：使用(0补给)。投资上仅限10补给。
// 卡面：[fast]横置投资：在上面放置1补给。
// 卡面：[action]横置并弃掉投资：将本卡牌上所有补给移动到你的资源池，作为资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05233 投资：0 补给起步、上限 10；[快速]横置 +1 补给；[行动]横置弃掉 → 全部补给变资源。

export default {
  code: '05233',
  uses: 0,
  usesType: 'supplies',
  abilities: [
    {
      kind: 'action',
      label: '横置投资：在上面放置 1 补给（上限 10）',
      cost: { action: false, exhaust: true },
      criteria: [({ source }) => (source?.uses || 0) < 10],
      resolve: ({ source, api }) => {
        if ((source?.uses || 0) >= 10) { api.info('「投资」上最多只能有 10 补给。'); return }
        api.addUses(source, 1)
        api.info(`💰 「投资」上放置 1 补给（当前 ${source.uses}）。`)
      },
    },
    {
      kind: 'action',
      label: '横置并弃掉投资：把全部补给作为资源',
      cost: { exhaust: true, discardSelf: true },
      resolve: ({ source, inv, api }) => {
        const supplies = source?.uses || 0
        api.gainResources(inv.seat, supplies)
        api.info(`💰 ${inv.name} 兑现「投资」上的 ${supplies} 补给，获得 ${supplies} 资源。`)
      },
    },
  ],
}
