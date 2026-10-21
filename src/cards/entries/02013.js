// 02013 最后的狂想曲
// 卡面：显现 - 从混乱袋中揭示5个混乱标记。每揭示一个[skull]或[auto_fail]标记，受到1点伤害和1点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02013',
  abilities: [
    {
      kind: 'weakness', label: '最后的狂想曲', weakness: { type: 'finalRhapsody' },
      // Phase 5（5a-12）：结算迁到能力层——揭示最多 5 枚标记，骷髅/自动失败各 1 伤害 1 恐惧。
      resolve: ({ inv, api }) => {
        const tokens = api.revealChaosTokens(5)
        const harm = tokens.filter(token => token === 'skull' || token === 'autofail').length
        if (harm) api.harm(inv.seat, { damage: harm, horror: harm })
        api.info('最终狂想曲揭示 ' + tokens.map(token => api.tokenLabel(token)).join('、')
          + '；' + inv.name + ' 受到 ' + harm + ' 点伤害和 ' + harm + ' 点恐惧。')
      },
    },
  ],
  modifiers: [

  ],
}
