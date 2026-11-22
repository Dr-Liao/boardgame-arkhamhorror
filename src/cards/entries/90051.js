// 90051 最后的狂想曲（Final Rhapsody · Advanced）· 中立 · 诡计/弱点 · 吉姆专属弱点。
//
// 卡面（cards-data 90051）：
//   Advanced.
//   Revelation - Reveal 5 chaos tokens from the chaos bag. For each non-[elder_sign], non-[bless]
//     symbol token revealed, take 1 damage and 1 horror.
//
// 引擎读点：
//   · 弱点自定义结算：weakness 描述子带 `resolve(ctx)` 接管（weakness.js#resolveWeaknessBody）。
//   · 揭示 5 枚标记：`api.revealChaosTokens(5)`（api-card.js；走 chaos-reveal 统一揭示管线，
//     返回揭示的牌面字符串数组，并正常结算标记的数值/效果）。
//   · 符号面集合取引擎登记表（chaos-token-pool.js 的合法面）：
//     bless/curse/skull/cultist/tablet/elderthing/autofail/eldersign/frost；
//     卡面排除 [elder_sign] 与 [bless]，其余符号面各 1 伤害 1 恐惧。
//   · 伤害/恐惧：`api.harm(inv.seat, { damage, horror })`（02013 同写法）。

const code = '90051'
const SYMBOL_FACES = new Set(['bless', 'curse', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign', 'frost'])

export default {
  code,
  abilities: [
    {
      kind: 'weakness',
      label: '显现：揭示 5 个混乱标记，每个非旧印/非祝福的符号标记造成 1 伤害和 1 恐惧',
      weakness: { type: 'finalRhapsodyAdvanced' },
      resolve: ({ inv, api }) => {
        const tokens = api.revealChaosTokens(5)
        const hits = tokens.filter(token => SYMBOL_FACES.has(token) && token !== 'eldersign' && token !== 'bless').length
        api.info(`「最后的狂想曲」揭示 ${tokens.map(token => api.tokenLabel(token)).join('、')}。`)
        if (hits) api.harm(inv.seat, { damage: hits, horror: hits })
      },
    },
  ],
  modifiers: [],
}
