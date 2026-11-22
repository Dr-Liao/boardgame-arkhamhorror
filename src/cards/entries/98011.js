// 98011 愚行（Foolishness）· 中立 · 支援/盟友/生物/幻梦境 · 费用 4 · 生命 1 / 恐惧 4 · 替换（卡洛琳·弗恩）。
// 卡面（cards-data 98011）：
//   卡洛琳·弗恩牌库专用。替换。
//   愚行入场时带有 3 点恐惧。它上面的恐惧可以如同在卡洛琳·弗恩身上一样被治愈。
//   当愚行上没有恐惧时，你所有技能 +1。
//
// 引擎读点：
//   · 「入场时带有 3 点恐惧」= entersPlay 描述子（actions.js#doPlay 入场段执行）+ api.addAssetHorror
//     （支援恐惧的唯一写点）；
//   · 「没有恐惧时全技能 +1」= modifiers [{ target:'skill:*', condition 读 source.horror }]
//     （modifiers.js#legacyStatDelta 对每张支援按 asset.horror 求值）。
// 缺原语：「它上面的恐惧可以如同在卡洛琳身上一样被治愈」：现有的可选治疗改道读点
//   （harm-threat.js#healHorrorFrom 的 redirectHeal/threatHorrorSink）只认**威胁区卡**作为恐惧汇点，
//   不认支援（盟友）→ primitive-requests/core-cards-a-98011-foolishness-heal-as-investigator.json。
//   当前近似：不提供治疗改道；其余两段已接线。
const code = '98011'

export default {
  code,
  abilities: [{
    kind: 'entersPlay',
    label: '愚行入场时带有 3 点恐惧',
    resolve: ({ source, api }) => {
      if (!source) return
      api.addAssetHorror(source, 3)
      api.info(`愚行入场，带有 ${source.horror || 3} 点恐惧。`)
    },
  }],
  modifiers: [{
    target: 'skill:*',
    amount: 1,
    condition: { when: ({ source }) => (source?.horror || 0) === 0 },
  }],
  note: '近似：「入场带 3 恐惧」与「无恐惧时全技能 +1」已接线；「恐惧可如同在卡洛琳身上被治愈」的可选改道只支持威胁区卡（redirectHeal 读点），支援（盟友）作恐惧汇点缺原语 → primitive-requests/core-cards-a-98011-foolishness-heal-as-investigator.json。',
}
