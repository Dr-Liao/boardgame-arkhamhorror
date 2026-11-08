// 08730 克莱普尔的皮草（Claypool 的皮草）· 剧情资产 · memorials_of_the_lost
// 卡面：快速。[reaction]你执行的技能检定期间，在你揭示一个[frost]标记时，对克莱普尔的皮草造成
//   1 点伤害：取消该混乱标记并将其放回混乱袋，揭示一个新的混乱标记。
// 读点：tokenReveal 反应窗口 + api.placeAssetHarm（伤害必须坐落在该支援上）；替代标记走
//   context.replacementToken（与 08112 同一条引擎通道）。
const CODE = '08730'

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  fast: true,
  flags: { memorial: true, health: 3 },
  abilities: [{
    kind: 'reaction', trigger: 'tokenReveal',
    label: '皮草：受伤 1 点，取消本次 [frost] 并改揭新标记',
    criteria: ({ state, inv, source, context }) => context?.when === 'tokenReveal' && context?.token === 'frost'
      && state.skillTest?.seat === inv.seat
      && (inv.assets || []).some(asset => asset === source || asset.id === source.id),
    resolve: ({ source, context, api }) => {
      api.placeAssetHarm(source, { damage: 1 })
      const revealed = api.revealChaosTokens(1)[0]
      if (revealed == null) {
        api.info('「克莱普尔的皮草」：混乱袋里没有可替代的标记。')
        return
      }
      context.replacementToken = revealed
      api.info('🧥 「克莱普尔的皮草」：取消 [frost]，改为揭示「' + api.tokenLabel(revealed) + '」。')
    },
  }],
}

