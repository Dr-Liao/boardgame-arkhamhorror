// 60209 养神术
// 卡面：使用(3秘密)。
// 卡面：[action]横置养神术并花费1秘密：进行一次[intellect](1)检定。你每成功超过难度1点(最多3点)，抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60209',
  uses: 3,
  usesType: 'secrets',
  abilities: [{
    kind: 'action', cost: { action: true, exhaust: true, uses: 1 },
    label: '横置并花费 1 秘密：智识 (1)，每超过难度一点抽一张，最多三张',
    resolve: ({ inv, api }) => api.test(inv.seat, 'intellect', 1, {
      source: { code: '60209', label: '充实心灵' },
      resolve: result => {
        const amount = Math.min(3, Math.max(0, result.value - result.difficulty))
        if (result.success && amount > 0) api.drawCards(inv.seat, amount)
      },
    }),
  }],
}
