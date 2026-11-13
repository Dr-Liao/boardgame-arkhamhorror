// 09677 酷刑折磨（Excruciate）· 诡计（[[妖术]]）· shades_of_suffering
//
// 归属：关卡专用 · theScarletKeys/shadesOfSuffering（P7）。遭遇牌库 2 份。
// 卡面：
//   显现 - 在影穑上放置 1 充能。检定[意志](3)（如果影穑上有至少 8 充能，难度改为 6）。
//   如果你检定失败，你必须受到 2 点伤害；或者每低于难度 1 点，弃掉 1 张手牌。
//
// 读点（章节 behavior，条目只声明数据）：
//   · behavior.resolveEncounter 按 `treacheryRule.resolveKind: 'excruciate'` 分派；
//   · 显现的充能数读 `treacheryRule.chargeOnReveal`、难度读 `treacheryRule.testSkill/testDifficulty`
//     （`testDifficultyAtCharges` 表达「影穑上有至少 8 充能时改为 6」）、失败分支读
//     `treacheryRule.failChoice`（每失败 1 点弃 1 张手牌，或受到 2 点伤害）。
// 充能读写 `scenarioFlags.shadeReaperCharges`（见 primitive-requests/extend-scarlet-key-charges.json）。
export default {
  code: '09677',
  name: '酷刑折磨',
  scope: 'treachery',
  implemented: true,
  treacheryRule: {
    resolveKind: 'excruciate',
    chargeOnReveal: 1,
    testSkill: 'willpower',
    testDifficulty: 3,
    testDifficultyAtCharges: { atLeast: 8, difficulty: 6 },
    failChoice: { discardCardsPerFailedBy: true, damage: 2 },
  },
  note: 'approximation: 影穑的充能记在场景旗标 `scenarioFlags.shadeReaperCharges`（密钥原语没有计数器），'
    + '条目本身不直写状态；弃手牌用 api.discardRandomFromHand（随机），与卡面「弃掉」同口径。',
}
