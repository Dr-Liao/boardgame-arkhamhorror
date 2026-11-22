// 60315 小偷小摸
// 卡面：调查。本次调查不使用[intellect]，改为使用[agility]。如果你成功，额外发现你所在地点的2个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60315',
  abilities: [{
    kind: 'played', countsAs: 'investigate', label: '以敏捷调查；成功额外发现 2 个线索',
    effect: { type: 'investigate', skill: 'agility', clueBonus: 2 },
  }],
}
