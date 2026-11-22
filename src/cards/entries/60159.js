// 60159 防护背心（Protective Vest）
// 卡面：[reaction] 你打出防护背心后：查找你牌库顶 6 张，找出一张[[枪械]]或[[升级]]卡加入手牌，洗回牌库。
// 读点：reaction trigger assetEnteredPlay（investigator-mechanics.js 窗口 context.assetCode）+ api.searchTop 的 traits 过滤。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60159',
  abilities: [{
    kind: 'reaction',
    trigger: 'assetEnteredPlay',
    label: '打出后：查找牌库顶 6 张中的一张[[枪械]]/[[升级]]，加入手牌',
    criteria: [({ inv, context }) => context?.seat === inv.seat && context?.assetCode === '60159'],
    resolve: ({ inv, api }) => api.searchTop(inv.seat, {
      amount: 6, traits: ['firearm', 'upgrade'], choose: 1, source: '60159',
      prompt: '查找牌库顶 6 张，选择 1 张[[枪械]]或[[升级]]加入手牌。',
    }),
  }],
  modifiers: [],
}
