// 08718 艾弗里·克莱普尔（Avery Claypool） · 剧情资产（伙伴）· expedition_team
// 归属：战役共用 · edgeOfTheEarth/_shared（开局/关卡由章节按 Partner 原语交给调查员）。
// 卡面：伙伴。使用(5补给)。[reaction]你所在地点的一位调查员在技能检定期间揭示了[frost]标记时，横置并花费 1 补给：取消该标记并揭示一个新的标记。
// 读点：条目 uses/usesType 提供「使用(N secret/supply/ammo/resources)」次数（实例创建时由
//   campaign 侧照抄）；主动/反应能力走 abilities 描述子，写入只走 ctx.api。

const CODE = '08718'

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  flags: { partner: true, partnerRules: { reaction: 'cancelFrostRevealNewToken' } },
  uses: 5, usesType: 'supplies',
  abilities: [{
    kind: 'reaction', trigger: 'tokenReveal',
    label: '花费 1 补给并横置：取消本次 [frost] 标记，改为揭示一个新标记',
    cost: { exhaust: true, uses: 1 },
    criteria: ({ state, inv, context }) => context?.when === 'tokenReveal' && context?.token === 'frost'
      && state.investigators?.[state.skillTest?.seat]?.location === inv.location,
    resolve: ({ context, api }) => {
      const revealed = api.revealChaosTokens(1)[0]
      if (revealed == null) {
        api.info('「艾弗里·克莱普尔」：混乱袋里没有可替代的标记。')
        return
      }
      context.replacementToken = revealed
      api.info('「艾弗里·克莱普尔」：取消 [frost]，改为揭示「' + api.tokenLabel(revealed) + '」。')
    },
  }],
}


