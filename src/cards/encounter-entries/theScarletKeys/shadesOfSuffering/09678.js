// 09678 魂灵收割（Spirit Harvest）· 诡计（[[妖术]]、险境）· shades_of_suffering
//
// 归属：关卡专用 · theScarletKeys/shadesOfSuffering（P7）。遭遇牌库 3 份。
// 卡面：
//   险境。
//   显现 - 选择一项：
//   - 每位调查员受到 1 点伤害和 1 点恐惧。
//   - 朱三娘变换影穑，然后在上面放置 2 充能。
//
// 读点（章节 behavior，条目只声明数据）：
//   · behavior.resolveEncounter 按 `treacheryRule.resolveKind: 'spiritHarvest'` 分派；
//   · 两个选项读 `treacheryRule.damage/horror`（全体伤害恐惧）与
//     `treacheryRule.shiftKey/charges`（朱三娘变换影穑 + 充能数；behavior.shiftShadeReaper by="tzuSanNiang"）；
//   · 险境由 definition 的 `peril: true` 进入遭遇定义（印刷字段），条目这里再声明一次供审计。
export default {
  code: '09678',
  name: '魂灵收割',
  scope: 'treachery',
  implemented: true,
  treacheryRule: {
    resolveKind: 'spiritHarvest',
    peril: true,
    damage: 1,
    horror: 1,
    shiftKey: true,
    charges: 2,
  },
  note: 'approximation: 充能记在场景旗标 `scenarioFlags.shadeReaperCharges`；'
    + '参考实现把第二项写成 3 充能，这里按卡面（本仓库 08 号段卡面数据）取 2。',
}
