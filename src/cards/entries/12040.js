// 12040 神秘魔典（Mysterious Grimoire）· 资产 · 探求者 2 经验 · 手部槽
// 卡面：使用(4秘密)。
// 卡面：[fast]你的回合期间，花费 1 或 2 秘密并横置神秘魔典：查找你牌库顶 3 张（花 2 秘密改为 6 张），
//       找出 1 张卡牌并将其抽取。如果查找的卡牌中有弱点，也将其抽取。混洗你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 参考实现：Asset/Assets/MysteriousGrimoire2.hs
//   （freeTrigger (exhaust a <> UseCostUpTo Secret 1 2)；search fromTopOfDeck (1→3 / 2→6)，
//    SearchFound 后弱点全部抽走、其余再选 1 张抽走）。
// 读点：两条 action 描述子（[fast] = cost.action:false）分别花 1/2 秘密，走 api.searchTop
//   （与 05153 同一原语；drawWeakness 负责「查找的牌中有弱点也抽」）。
// 近似：参考实现会抽走查找牌中**全部**弱点；api.searchTop 的 drawWeakness 只额外抽 1 张弱点
//   （多张弱点时少抽），已在报告中列为近似。
export default {
  code: '12040',
  uses: 4,
  usesType: 'secrets',
  abilities: [
    {
      kind: 'action',
      label: '横置并花 1 秘密：查找牌库顶 3 张，找出 1 张并抽取（弱点也抽）',
      cost: { action: false, exhaust: true, uses: 1 },
      resolve: ({ inv, api }) => {
        api.searchTop(inv.seat, {
          amount: 3, choose: 1, drawWeakness: true, source: '12040',
          prompt: '神秘魔典：从牌库顶 3 张中找出任意 1 张并抽取。',
        })
      },
    },
    {
      kind: 'action',
      label: '横置并花 2 秘密：查找牌库顶 6 张，找出 1 张并抽取（弱点也抽）',
      cost: { action: false, exhaust: true, uses: 2 },
      resolve: ({ inv, api }) => {
        api.searchTop(inv.seat, {
          amount: 6, choose: 1, drawWeakness: true, source: '12040',
          prompt: '神秘魔典：从牌库顶 6 张中找出任意 1 张并抽取。',
        })
      },
    },
  ],
  modifiers: [],
}
