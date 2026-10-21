// 02232 艾丽莎·格雷厄姆
// 卡面：你得到+1[intellect]。
// 卡面：[free]横置艾丽莎·格雷厄姆：查看遭遇牌库或任意玩家牌库顶的卡牌。然后你可以在艾丽莎·格雷厄姆上增加1个毁灭标记，以将查看的卡牌放到其牌库底。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02232',
  modifiers: [
    { target: 'skill:intellect', amount: 1 },
  ],
  abilities: [
    {
      kind: 'action',
      label: '查看牌库顶牌',
      cost: { action: false, exhaust: true },
      effect: { type: 'lookTopDeckAndDoom' },
    },
  ],
}
