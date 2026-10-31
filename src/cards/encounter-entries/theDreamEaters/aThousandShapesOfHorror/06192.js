// 06192 诡计「发光的眼睛」（Glowing Eyes）· 万千骇形
// 归属：关卡专用 · aThousandShapesOfHorror。卡面：
// 显现 - 将发光的眼睛放置入场，放到你的威胁区域。
// 强制 - 当一轮结束时：你的威胁区域每有 1 张卡牌，受到 1 点恐惧，最多受到 3 点恐惧。弃掉发光的眼睛。
//
// 依据 Haskell Treachery/Cards/.../GlowingEyes.hs（n = min 3 (敌人 + 支援 + 诡计数)）：
//   · 进威胁区 → encounterResolve 调 api.threat；
//   · 轮末按威胁区张数受恐惧（含本卡）后弃掉 → treacheryRule.roundEndHorrorPerThreatCard 数据，
//     本章 behavior.roundEnded 在转发共享层后按数据结算（api.horror + api.removeThreat）。
export default {
  code: '06192',
  scope: 'treachery',
  implemented: true,
  treacheryRule: {
    threatArea: true,
    roundEndHorrorPerThreatCard: { cap: 3, discard: true },
  },
  encounterResolve(state, inv, treachery, api) {
    api.threat?.(inv.seat, '06192')
    api.info?.(`👀 「发光的眼睛」进入 ${inv.name} 的威胁区域。`)
    return true
  },
}
