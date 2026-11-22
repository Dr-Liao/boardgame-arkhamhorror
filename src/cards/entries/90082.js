// 90082 古代抄本（The Codex of Ages）· 中立 · 支援/道具/遗物/书籍/受祝 · 费用 2 · 进阶。
// 卡面（cards-data 90082）：
//   马泰奥神父牌库专用。进阶。封印（[elder_sign] 或至多 3 个 [bless]）。
//   有标记被封印在此支援上时，你得到 +1 项技能值。
//   [reaction] 在你所在地点的一位调查员将要揭示混乱标记时：该调查员改为结算封印在此的标记，
//     然后解除该标记的封印。（每次检定仅限一次。）
//
// 引擎读点：
//   · 入场封印 = 条目级 sealOnEnterChoice（seal-entry.js#chooseEntrySeal，doPlay 入场段读取）；
//     本实现按 `['eldersign','bless']` 二选一封印 1 枚（近似「至多 3 个 bless」，见 note）。
//   · 「有标记封印在此：+1 项技能」= passive.statsWhileSealed（modifiers.js#legacyStatDelta 读点，
//     条件 = state.chaos.sealed 中存在 source === 本支援 id 的封印记录）。
//   · 「改为结算封印标记、然后解除封印」：揭示替换读点目前只有 campaign-plugin.js#campaignBeforeChaosReveal
//     的「弃掉支援 + 结算封印标记」（04199 语义），没有「结算后解除封印、支援留场」的接口
//     → primitive-requests/core-cards-a-90082-codex-advanced-substitute.json（与 90081/90038 同一缺口）。
const code = '90082'

export default {
  code,
  sealOnEnterChoice: ['eldersign', 'bless'],
  passive: { statsWhileSealed: { willpower: 1, intellect: 1, combat: 1, agility: 1 } },
  abilities: [],
  modifiers: [],
  note: '近似：入场封印按「[elder_sign] 或 1 个 [bless]」二选一（印刷为「至多 3 个 bless」）；封印期间四技能 +1 已接线；「揭示时改为结算封印标记并解除封印」缺替换读点 → primitive-requests/core-cards-a-90082-codex-advanced-substitute.json。',
}
