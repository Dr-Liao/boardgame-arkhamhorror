// 04264 离体体验
// 卡面：显现 - 将你所有手牌洗入你的牌库并抽取等量的卡牌。将离体体验洗入你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 结算读点：src/engine/weakness.js 的 outOfBody 分支（弱点数据体通道）。
// 结算口径（2026-11-12 修复）：本卡自己也属于「你所有手牌」，洗回张数与抽牌张数都要 +1；
// 否则空手抽到它时张数为 0，它既不洗牌也不抽牌、结算后又洗回牌库，会形成
// 「抽到 → 无事发生 → 洗回」的无限抽牌循环。本卡在抽牌期间不在牌库中，
// 因此不会被自己的显现递归重抽，整副牌张数守恒、只洗回一次。

export default {
  code: '04264',
  abilities: [
    { kind: 'weakness', label: '离体体验', weakness: { type: 'outOfBody' } },
  ],
  modifiers: [

  ],
}
