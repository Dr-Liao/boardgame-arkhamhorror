// 09724 误见阴影（Seeing Shadows） · 诡计 · dark_veiling
// 归属：战役共用 · theScarletKeys/_shared/darkVeiling。
// 卡面：显现 - 将误见阴影放置入场，放到你的威胁区域。
//   强制 - 你在有隐匿迷你卡牌的地点时，技能检定失败后：受到 1 点恐惧。
//   [action][action]：弃掉误见阴影。
//   Revelation - Put Seeing Shadows into play in your threat area.
//   Forced - After you fail a skill test while at a location with a concealed mini-card: Take 1 horror.
//   [action][action]: Discard Seeing Shadows.
// 读点：
//   · 威胁区入场 = api.threat + 条目 treacheryRule.threatArea（与 01182/07106 同款模板）；
//   · 「技能检定失败后」= 引擎 testEnds 窗口（tests.js#closeTest 派发，context 带 seat/result）；
//     判定读 context.result.success（B3 检定结果契约）；
//   · 「有隐匿迷你卡牌的地点」= 只读 concealed 容器里的 locationId（不看正面身份）；
//   · 弃掉本卡 = api.removeThreat（威胁区卡唯一弃置写入口）；[action][action] 用 cost.action: 2。
const CODE = '09724'

const miniCardsIn = state => state.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards || []
const holderOf = (state, source) => (state.investigators || [])
  .find(inv => (inv.threat || []).includes(source)) || null

export default {
  code: CODE, scope: 'treachery', implemented: true,
  treacheryRule: { threatArea: true },
  encounterResolve(state, inv, card, api) {
    api.threat(inv.seat, CODE)
    api.info?.(`👁️ 「误见阴影」进入 ${inv.name} 的威胁区域。`)
    return true
  },
  abilities: [{
    kind: 'forced', trigger: 'testEnds', silent: true,
    label: '在有隐匿迷你卡牌的地点检定失败后：受到 1 点恐惧',
    criteria: ({ state, source, context }) => {
      const holder = holderOf(state, source)
      if (!holder || context?.seat !== holder.seat) return false
      if (context?.result?.success !== false) return false
      return miniCardsIn(state).some(card => card.locationId === holder.location)
    },
    resolve: ({ state, inv, source, api }) => {
      const holder = holderOf(state, source) || inv
      if (!holder || holder.defeated || holder.resigned) return
      api.horror(holder.seat, 1)
      api.info?.(`👁️ 「误见阴影」：${holder.name} 受到 1 点恐惧。`)
    },
  }, {
    kind: 'action', actionKind: 'activate', cost: { action: 2 },
    label: '弃掉误见阴影（花费 2 个行动）',
    resolve: ({ source, api }) => {
      api.removeThreat(source)
      api.info?.('👁️ 「误见阴影」被弃掉了。')
    },
  }],
  note: 'approximation: 「技能检定失败后」用引擎 testEnds 窗口的 result.success 判定（该窗口只在有监听者时打开，'
    + '本条目即为监听者）。无缺读点。',
}
