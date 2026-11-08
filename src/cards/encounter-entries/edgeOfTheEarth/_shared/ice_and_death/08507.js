// 08507 冰封荒原（Icy Wastes） · 地点 · ice_and_death
// 归属：战役共用 · edgeOfTheEarth/_shared。
// 卡面：在冰封荒原的每次技能检定期间，改为将揭示的第一个[frost]标记的修正值视为 -3，而不是 -1。背面：进入本地点的额外费用（共同花费 1[per_investigator] 线索）。庇护 4。
// 读点：地点能力走条目 abilities（非玩家能力来源含已揭示地点）；写入只走 ctx.api。
//   庇护值属印刷地点数据（章节 definition 从卡表/参考实现抄录；本条目只声明 flags.shelter）。

const CODE = '08507'

const firstFrost = state => (state.skillTest?.tokenResults || []).some(item => item.face === 'frost')

export default {
  code: CODE, scope: 'location', implemented: true,
  flags: { shelter: 4, campCandidate: true, entryGroupCluesPerInvestigator: 1, firstFrostModifier: -3 },
  abilities: [{
    kind: 'forced', trigger: 'tokenReveal',
    label: '冰封荒原：本次检定的第一个 [frost] 修正视为 -3',
    criteria: ({ state, source, inv, context }) => context?.token === 'frost'
      && state.skillTest?.seat === inv.seat
      && state.investigators?.[inv.seat]?.location === source.id
      && !firstFrost(state),
    resolve: ({ api }) => {
      api.mechanics.chaosTokens.treat({ as: 'frost', modifier: -3 })
      api.info('🧊 「冰封荒原」：第一个 [frost] 标记修正视为 -3。')
    },
  }],
}


