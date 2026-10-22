// 03266 奥术洞察
// 卡面：使用(3充能)。
// 卡面：[free]一位调查员进行自己的回合时，花费1充能：直到本回合结束，你所在地点的隐藏值-2。(每回合仅限一次。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03266 奥术洞察：每轮一次，把所在地点的帷幕 -2（旧 arcaneInsight，消耗 1 充能）。

export default {
  code: '03266',
  uses: 3,
  usesType: 'charges',
  abilities: [
    {
      kind: 'action', label: '奥术洞察降低帷幕', cost: { action: false, uses: 1 },
      limit: { scope: 'perTurn', owner: 'instance' },
      resolve: ({ state, inv, api }) => {
        const location = state.locations.find(item => item.id === inv.location)
        if (location) api.tempShroudMod(location, -2)
      },
    },
  ],
  modifiers: [

  ],
}
