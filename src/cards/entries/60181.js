// 60181 防护背心（Protective Vest，4 级）
// 卡面：你拥有额外 1 个手部槽位，只可携带[[枪械]]支援。[reaction] 你打出防护背心后：查找牌库顶 9 张，找出一张[[枪械]]或[[升级]]加入手牌，洗回牌库。
// 读点：restrictedSlots（assets.js occupiedSlots 唯一读点）；reaction trigger assetEnteredPlay + api.searchTop traits。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '60181',
  restrictedSlots: [{ slot: 'hand', traitsAny: ['Firearm'], count: 1 }],
  abilities: [{
    kind: 'reaction',
    trigger: 'assetEnteredPlay',
    label: '打出后：查找牌库顶 9 张中的一张[[枪械]]/[[升级]]，加入手牌',
    criteria: [({ inv, context }) => context?.seat === inv.seat && context?.assetCode === '60181'],
    resolve: ({ inv, api }) => api.searchTop(inv.seat, {
      amount: 9, traits: ['firearm', 'upgrade'], choose: 1, source: '60181',
      prompt: '查找牌库顶 9 张，选择 1 张[[枪械]]或[[升级]]加入手牌。',
    }),
  }],
  modifiers: [],
}
