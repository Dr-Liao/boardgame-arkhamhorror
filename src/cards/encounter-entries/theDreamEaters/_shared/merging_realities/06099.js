// 06099 窥看地下世界（Glimpse of the Underworld，诡计，2 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：merging_realities（WN / ATSOH）。
// 卡面：Revelation - 将窥看地下世界放置入场，放到你的威胁区域。
//       强制 - 在你将受到伤害和/或恐惧时：受到额外 1 点伤害或恐惧。
//       [fast]：弃掉窥看地下世界。然后，受到 1 点伤害和 1 点恐惧。
// 实现：威胁区放置走 api.threat；「受到额外 1 点」用引擎 harmInterceptor（读点 enemies.js 的
//   applyThreatHarmInterceptors）——引擎每个拦截器只能指定伤害或恐惧之一，这里按伤害声明
//   （simplified：纯恐惧来源未加）。[fast] 摆脱写成 threatAction + flags.followUp，共享层
//   performEncounterAction 尚未支持 followUp → coordinator request。
export default {
  code: '06099',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { threatArea: true },
  harmInterceptor: { trigger: 'damage', extra: 1 },
  threatAction: {
    rule: 'discardGlimpseOfTheUnderworld',
    label: '👁️ [快速]：弃掉窥看地下世界，然后受到 1 伤害和 1 恐惧',
    noTest: true,
    actions: 0,
    target: 'threat',
  },
  encounterResolve(state, inv, card, api) {
    api.threat?.(inv.seat, '06099')
    api.info?.(`👁️ ${inv.name} 窥见了地下世界。`)
    return true
  },
  // 共享 performEncounterAction 读 flags.fastDiscardFollowUp：[fast] 弃掉后受到 1 伤 1 恐。
  flags: { fastDiscardFollowUp: { damage: 1, horror: 1 } },
  simplified: true,
  note: '「受到额外 1 点伤害或恐惧」按伤害声明（引擎 harmInterceptor 每个拦截器只能指定伤害或恐惧之一）。',
}
