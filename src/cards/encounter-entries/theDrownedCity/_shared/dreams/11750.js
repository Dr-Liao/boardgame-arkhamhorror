// 11750 引向黑暗（Drawn to Darkness）· 诡计 · 共享遭遇组 dreams（印刷 3 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/dreams。
// 卡面（cards-data 11750）：
//   显现 - 将引向黑暗放置入场，位于你的威胁区。每位调查员限1张。
//   你的手牌上限-3(最少为1)。
//   强制 - 你的回合结束时，如果你没有手牌：弃掉引向黑暗。
//
// 读点（声明即接线）：
//   · 威胁区入场 = api.threat；重复副本判重后由引擎弃置；
//   · 「手牌上限 -3」= 条目 threatEffect.handSizeModifier（stats.js#handSize 对
//     inv.threat 逐张读 getThreatEffect(card)?.handSizeModifier，getThreatEffect 先读条目 threatEffect）；
//   · 「最少为 1」= 条目 threatEffect.handSizeMinimum: 1（stats.js#handSize 取各威胁卡 minimum 的最大值，
//     最终 `Math.max(0, minimum, 计算值)`；只在持有本卡（或其它声明了 minimum 的威胁卡）时生效）；
//   · 「你的回合结束时若没有手牌」= turnEnded 窗口 + 持有者手牌判定 + api.removeThreat。
const CODE = '11750'

const holderOf = (state, source) => (state?.investigators || [])
  .find(inv => (inv.threat || []).includes(source)) || null

export default {
  code: CODE,
  name: '引向黑暗',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { threatArea: true },
  threatEffect: { handSizeModifier: -3, handSizeMinimum: 1 },
  flags: {
    threatArea: true,
    traits: ['Power'],
    quantity: 3,
    limitPerInvestigator: 1,
    handSizeModifier: -3,
  },
  encounterResolve(state, inv, card, api) {
    if ((inv.threat || []).some(item => (item.originalCode || item.code) === CODE)) {
      api.info?.(`🌑 「引向黑暗」：${inv.name} 已经有一张，本次不放入场（每位调查员仅限 1 张）。`)
      return false
    }
    api.threat(inv.seat, CODE)
    api.info?.(`🌑 「引向黑暗」进入 ${inv.name} 的威胁区域：手牌上限 -3（最少为 1）。`)
    return true
  },
  abilities: [{
    kind: 'forced',
    trigger: 'turnEnded',
    silent: true,
    label: '你的回合结束时若没有手牌：弃掉引向黑暗',
    criteria: ({ state, source, context }) => {
      const holder = holderOf(state, source)
      return Boolean(holder) && context?.seat === holder.seat && (holder.hand || []).length === 0
    },
    resolve: ({ state, source, api }) => {
      const holder = holderOf(state, source)
      if (!holder) return
      api.removeThreat?.(source)
      api.info?.(`🌑 「引向黑暗」：${holder.name} 回合结束且没有手牌，弃掉本卡。`)
    },
  }],
  note: '手牌上限 -3 走 threatEffect.handSizeModifier（stats.js#handSize 对威胁区卡逐张读）；'
    + '「最少为 1」走同函数的 threatEffect.handSizeMinimum: 1（取各威胁卡 minimum 最大值后 Math.max(0, minimum, 计算值)，'
    + '回合结束弃到上限时按同一 getHandSize 结算）。回合结束空手弃卡走 turnEnded + api.removeThreat。无近似项。',
}
