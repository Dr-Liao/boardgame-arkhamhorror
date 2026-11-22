// 60305 撬锁工具
// 卡面：[action]横置撬锁工具：调查。本次调查中，将你的[agility]加到你的技能值上。如果你未成功超过难度至少2点，弃掉撬锁工具。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60305',
  abilities: [{
    kind: 'action', countsAs: 'investigate',
    cost: { action: true, exhaust: true },
    label: '横置并调查：加上敏捷；未成功超过至少 2 点则弃掉本牌',
    resolve: ({ inv, source, api }) => {
      const result = api.investigate(inv.seat, { addSkill: 'agility' })
      if (!result?.success || result.value - result.difficulty < 2) api.discardAsset(inv.seat, source)
    },
  }],
}
