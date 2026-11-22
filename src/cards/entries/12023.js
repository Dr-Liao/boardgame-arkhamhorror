// 12023 磨刀不误砍柴工
// 卡面：查找你牌库顶的9张卡牌，找出一张[[工具]]或[[武器]]支援，将其加入你的手牌。混洗你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：查找牌库顶 N 张 = api.searchTop（src/engine/card-ops.js#searchTop 是「查找牌库顶」的唯一
// 实现，与 01031 智慧古书 / 05153「老千」先生同一读点）；筛选条件 traits（[[工具]] 或 [[武器]]，任一）
// + typeFilter: 'asset'；选中的牌走真实抽牌通道加入手牌，其余洗回牌库（与卡面一致）。

export default {
  code: '12023',
  abilities: [
    {
      kind: 'played',
      label: '查找牌库顶 9 张中的一张 [[工具]] 或 [[武器]] 支援并加入手牌，然后洗回牌库',
      effect: {
        type: 'searchTop',
        amount: 9,
        traits: ['Tool', 'Weapon'],
        typeFilter: 'asset',
        choose: 1,
        source: '12023',
      },
    },
  ],
  modifiers: [
  ],
}
