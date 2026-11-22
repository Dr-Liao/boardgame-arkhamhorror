// 12043 狂野知识（Unbridled Knowledge）· 事件 · 探求者 5 经验 · 费用 1
// 卡面：揭示你牌库顶的 5 张卡牌（如果你控制至少 2 个线索，改为 8 张）。从中抽取 3 张，
//       将其余卡牌以任意顺序放到你的牌库顶和/或牌库底。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 参考实现：Event/Events/UnbridledKnowledge5.hs
//   （n = clues >= 2 ? 8 : 5；FromTopOfDeck n → searchFoundStrategy DrawFound iid 3，
//    其余 PutBackInAnyOrderBothTopAndBottom）。
// 读点：api.lookAt（批次 3 扩展后的两种放回方式组合）：
//   · choose:3 → 选中的 3 张走真实抽牌通道进手牌；
//   · arrange:true → 其余牌先按任意顺序排列（>4 张走线性顺序询问）；
//   · returnStrategy:'topAndBottom' → 排列后的每张牌逐张询问放牌库顶还是牌库底，两堆各自保持相对顺序
//     （deck-ops.js#lookAt 的 topAndBottom 分支）。卡面「牌库顶和/或牌库底、任意顺序」因此完整实现。
export default {
  code: '12043',
  playCondition: [{
    when: ({ inv }) => (inv.deck || []).length >= 3,
    message: '牌库中不足 3 张卡牌',
  }],
  abilities: [
    {
      kind: 'played',
      label: '揭示牌库顶 5/8 张：抽 3 张，其余按任意顺序放到牌库顶和/或牌库底',
      resolve: ({ inv, api }) => {
        const count = (Number(inv.clues) || 0) >= 2 ? 8 : 5
        api.lookAt(inv.seat, {
          zone: 'investigatorDeck',
          count,
          choose: 3,
          arrange: true,
          returnStrategy: 'topAndBottom',
          source: '12043',
          prompt: `狂野知识：查看牌库顶 ${Math.min(count, (inv.deck || []).length)} 张，抽取 3 张，其余按任意顺序放到牌库顶和/或牌库底。`,
        })
      },
    },
  ],
  modifiers: [],
}
