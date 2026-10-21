// 01027 警徽
// 卡面：你得到+1[willpower]。
// 卡面：[free]你所在地点的调查员在进行自己回合时，弃掉警徽：该调查员本回合可以进行额外2次行动。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 01027 警徽：+1 意志；免费弃掉自己，正在行动的同地点调查员 +2 行动。

export default {
  code: '01027',
  passive: { stats: { willpower: 1 } },
  abilities: [
    {
      kind: 'action', label: '亮出警徽（弃掉警徽，正在行动的同地点调查员 +2 行动）',
      cost: { action: false, discardSelf: true },
      effect: { type: 'targetedEffect', target: 'location', activeTurnOnly: true,
        effect: { type: 'gainAction', amount: 2 } },
    },
  ],
  modifiers: [

  ],
}
