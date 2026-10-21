// 03151 达里奥·埃尔阿明
// 卡面：你拥有10点或更多资源时，你得到+1[willpower]和+1[intellect]。
// 卡面：[action]如果你所在地点没有敌人，横置达里奥·埃尔阿明：获得2资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03151',
  passive: { conditionalStats: { resourcesAtLeast: 10, stats: { willpower: 1, intellect: 1 } } },
  abilities: [
    {
      kind: 'action', label: '达里奥获得2资源', cost: { action: true, exhaust: true },
      effect: { type: 'gainResource', amount: 2 },
    },
  ],
  modifiers: [

  ],
}
