// 09745 突来冲动（Compulsion） · 诡计 · spreading_corruption
// 归属：战役共用 · theScarletKeys/_shared/spreadingCorruption。
// 卡面：显现 - 将突来冲动放置入场，放到你的威胁区域。
//   强制 - 在你的回合开始时：从混乱袋中随机揭示 1 个混乱标记。如果这是一个 [skull]、[cultist]、
//   [tablet] 或 [elder_thing] 标记，如可能，你本回合期间执行的第一个行动必须是下列能力：
//   [action][action]：弃掉突来冲动。
//   Revelation - Put Compulsion into play in your threat area.
//   Forced - When your turn begins: Reveal a random chaos token from the chaos bag. If it is a [skull],
//   [cultist], [tablet], or [elder_thing] token, the first action you perform during this turn must be the
//   below ability, if able. [action][action]: Discard Compulsion.
// 读点：
//   · 威胁区入场 = api.threat + 条目 treacheryRule.threatArea（与 01182/07106 同款模板）；
//   · 「你的回合开始时」= turnBegins 窗口（turn.js#turnBeginningWindow 派发，context 带 seat/location）；
//   · 「随机揭示 1 个混乱标记」= api.revealToken（回合开始时不做检定，走 chaos-token 揭示管线，
//     含标记替换与 scenarioBehavior.chaosTokenRevealed 钩子）；
//   · [action][action] 弃掉 = api.removeThreat（威胁区卡唯一弃置写入口）+ cost.action: 2；
//   · 符号标记通过 markRequiredFirstAction 标记本回合须优先执行的能力。
const CODE = '09745'
const SYMBOLS = new Set(['skull', 'cultist', 'tablet', 'elderthing', 'elder_thing'])

const holderOf = (state, source) => (state.investigators || [])
  .find(inv => (inv.threat || []).includes(source)) || null

export default {
  code: CODE, scope: 'treachery', implemented: true,
  treacheryRule: { threatArea: true, requiredFirstAction: 'discardCompulsion' },
  encounterResolve(state, inv, card, api) {
    api.threat(inv.seat, CODE)
    api.info?.(`🌀 「突来冲动」进入 ${inv.name} 的威胁区域。`)
    return true
  },
  abilities: [{
    kind: 'forced', trigger: 'turnBegins', silent: true,
    label: '你的回合开始时：随机揭示 1 个混乱标记；符号标记则本回合第一个行动必须是弃掉本卡',
    criteria: ({ state, source, context }) => {
      const holder = holderOf(state, source)
      return Boolean(holder) && context?.seat === holder.seat
    },
    resolve: ({ state, inv, source, api }) => {
      const holder = holderOf(state, source) || inv
      if (!holder || holder.defeated || holder.resigned) return
      const token = api.scenario.revealToken(holder.seat)
      const symbol = SYMBOLS.has(String(token))
      if (symbol) api.markRequiredFirstAction(source)
      api.info?.(`🌀 「突来冲动」揭示 ${api.tokenLabel(token)}${symbol ? '：本回合第一个行动必须是弃掉本卡（如可能）。' : '：本次不受影响。'}`)
    },
  }, {
    id: 'discardCompulsion', kind: 'action', actionKind: 'activate', cost: { action: 2 },
    label: '弃掉突来冲动（花费 2 个行动）',
    resolve: ({ source, api }) => {
      api.removeThreat(source)
      api.info?.('🌀 「突来冲动」被弃掉了。')
    },
  }],
}
