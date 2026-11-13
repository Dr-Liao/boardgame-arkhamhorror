// 09722 暗中一刀（Knives in the Dark） · 诡计 · shadow_of_a_doubt
// 归属：战役共用 · theScarletKeys/_shared/shadowOfADoubt。
// 卡面：显现 - 如果你的威胁区域没有暗中一刀，将暗中一刀放置入场，放到你的威胁区域。否则，本卡牌获得涌动。
//   强制 - 你揭露诱饵后：受到 2 点伤害。（每轮仅限一次。）
//   强制 - 当你的回合结束时：检定 [agility](3)。如果你检定成功，弃掉暗中一刀。
//   Revelation - Put Knives in the Dark into play in your threat area if there is no copy of it in
//   your threat area. Otherwise, this card gains surge.
//   Forced - After you expose a decoy: Take 2 damage. (Limit once per round.)
//   Forced - At the end of your turn: Test [agility] (3). If you succeed, discard Knives in the Dark.
// 读点：
//   · 威胁区入场 = api.threat（威胁区实例唯一写入口）+ 条目 treacheryRule.threatArea（与 01182/07106 同款模板）；
//   · 「获得涌动」= encounterResolve 返回 { gainSurge: true }（encounter.js#finishDraw 同源）；
//   · 「回合结束时检定」= turnEnded 窗口（turn-flow.js 派发，context 带 seat/location）+ api.test；
//   · 弃掉本卡 = api.removeThreat（威胁区卡唯一弃置写入口）；
//   · 「揭露诱饵后」需要 tskExposed 窗口派发点（P2 只注册），见 primitive-requests/09722.json。
const CODE = '09722'

// 持有者：威胁区卡实例在谁的威胁区域（只读）。
const holderOf = (state, source) => (state.investigators || [])
  .find(inv => (inv.threat || []).includes(source)) || null

export default {
  code: CODE, scope: 'treachery', implemented: true,
  treacheryRule: { threatArea: true },
  encounterResolve(state, inv, card, api) {
    const existing = (inv.threat || []).some(item => (item.originalCode || item.code) === CODE)
    if (existing) {
      api.info?.(`🔪 ${inv.name} 的威胁区域已有「暗中一刀」：获得涌动。`)
      return { gainSurge: true }
    }
    api.threat(inv.seat, CODE)
    api.info?.(`🔪 「暗中一刀」进入 ${inv.name} 的威胁区域。`)
    return true
  },
  abilities: [{
    kind: 'forced', trigger: 'tskExposed', silent: true,
    label: '你揭露诱饵后：受到 2 点伤害（每轮仅限一次）',
    limit: { scope: 'perRound', owner: 'instance' },
    criteria: ({ state, source, context }) => context?.decoy === true && Boolean(holderOf(state, source))
      && (context.seat == null || holderOf(state, source)?.seat === context.seat),
    resolve: ({ state, inv, source, context, api }) => {
      const holder = holderOf(state, source) || inv
      if (!holder || holder.defeated || holder.resigned) return
      api.damage(holder.seat, 2)
      api.info?.(`🔪 「暗中一刀」：${holder.name} 揭露诱饵后受到 2 点伤害。`)
      void context
    },
  }, {
    kind: 'forced', trigger: 'turnEnded', silent: true,
    label: '你的回合结束时：检定敏捷(3)，成功后弃掉暗中一刀',
    criteria: ({ state, source, context }) => {
      const holder = holderOf(state, source)
      return Boolean(holder) && context?.seat === holder.seat
    },
    resolve: ({ state, inv, source, api }) => {
      const holder = holderOf(state, source) || inv
      if (!holder || holder.defeated || holder.resigned) return
      api.test(holder.seat, 'agility', 3, {
        source: { type: 'scenario', action: 'activate', code: CODE, name: '暗中一刀', ability: true },
        target: { kind: 'card', code: CODE },
        resolve: result => {
          if (!result.success) return
          api.removeThreat(source)
          api.info?.(`🔪 ${holder.name} 甩掉了「暗中一刀」。`)
        },
      })
    },
  }],
  note: 'approximation: 「揭露诱饵后受到 2 点伤害」已按 tskExposed 窗口实现，但引擎当前只在 '
    + 'tsk-interactions#expose 内揭露迷你卡、没有派发该窗口；「每轮仅限一次」由 limit perRound/instance 记账。'
    + '请求见 primitive-requests/09722.json。',
}
