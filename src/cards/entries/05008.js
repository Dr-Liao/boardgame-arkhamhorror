// 05008 理性思考
// 卡面：显现 - 将理性思考放置入场，放到你的威胁区域，带有4点恐惧。理性思考上的恐惧可以被治愈，
//       如同其在卡洛琳·弗恩上。如果理性思考上没有恐惧，将其弃掉。
// 卡面：你不能治愈理性思考以外卡牌上的恐惧。你不能从卡洛琳·弗恩的[reaction]能力获得资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 「它上面的恐惧优先被治疗」与「其他卡牌的恐惧不能被治疗」是引擎的统一读点
// （src/engine/harm-threat.js 的 healHorrorFrom），只认 `threatHorrorSink`；
// 「不能从卡洛琳的反应获得资源」由卡洛琳条目读 `blocksHealReward`。

export default {
  code: '05008',
  threatHorrorSink: true,
  blocksHealReward: true,
  // R7 heal v3 条目字段（引擎 healHorrorFrom 已按 healer 的 threat 条目读取）：
  // · redirectHeal.optional ——「可以如同在卡洛琳身上一样治愈」= 可选改道；
  // · overflow:'discard'   —— 超出其剩余恐惧的治疗量丢弃（不回流）；
  // · blockHealOtherCards  ——「你不能治愈理性思考以外卡牌上的恐惧」（调查员本人不受限）。
  redirectHeal: { optional: true },
  overflow: 'discard',
  blockHealOtherCards: true,
  abilities: [
    { kind: 'weakness', label: '理性思考', weakness: { type: 'threat', horror: 4 } },
  ],
  modifiers: [],
}
