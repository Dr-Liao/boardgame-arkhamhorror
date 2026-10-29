// 06005 派翠丝·海瑟薇
// 卡面：你的手牌上限减少 3 张。
//       在每个补给阶段期间，不抽取 1 张卡牌，改为弃掉你手牌中的全部非弱点卡牌，
//       抽取卡牌，直到你有 5 张手牌。
// 卡面：[elder_sign] 效果：+1。本次检定结束后，你可以将弃牌堆中的 1 张卡牌留下，将其余卡牌混洗回
//       你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · `handSizeModifier`：src/engine/stats.js 的 handSize()（手牌上限的唯一读点）。
//   · `upkeepDraw`：src/engine/phases.js 的补给阶段（抽牌段整段替换）。
//   · `shuffleDiscardAfterTest`：src/engine/tests.js 的旧印后续结算（真正的「本次检定结束后」）。

export default {
  code: '06005',
  kind: 'investigator',
  investigator: {
    handSizeModifier: -3,
    upkeepDraw: { discardNonWeakness: true, handSize: 5 },
    elderSign: { bonus: 1, shuffleDiscardAfterTest: { keep: 1 } },
  },
  elderSign: {
    id: '06005-eldersign',
    label: '旧印：+1，检定结束后可把弃牌堆留 1 张、其余洗回牌库',
    resolve: () => ({ delta: 1, shuffleDiscardAfterTest: { keep: 1 } }),
  },
  abilities: [],
  modifiers: [],
}
