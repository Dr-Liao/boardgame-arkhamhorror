// 08513 莱克营地遗址（Remnants of Lake’s Camp） · 地点 · ice_and_death
// 归属：战役共用 · edgeOfTheEarth/_shared。
// 卡面：[action]：检定[combat](4) 在雪地中挖掘。成功则记录「木制雪橇」（每个剧本最多一次成功）。背面：进入额外费用 4[per_investigator] 线索。庇护 7。
// 读点：地点能力走条目 abilities（非玩家能力来源含已揭示地点）；写入只走 ctx.api。
//   庇护值属印刷地点数据（章节 definition 从卡表/参考实现抄录；本条目只声明 flags.shelter）。

const CODE = '08513'
const WOODEN_SLEDGE = '08615'

export default {
  code: CODE, scope: 'location', implemented: true,
  flags: { shelter: 7, campCandidate: true, entryGroupCluesPerInvestigator: 4 },
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '挖掘 战斗(4)：记录「木制雪橇」',
    limit: { scope: 'perGame', owner: 'group' },
    resolve: ({ inv, api }) => {
      api.test(inv.seat, 'combat', 4, { source: { type: 'scenario', code: CODE, ability: true }, resolve: result => {
        if (!result.success) return
        api.mechanics.recordSets.add('suppliesRecovered', WOODEN_SLEDGE)
        api.info('🛷 「莱克营地遗址」：记录「木制雪橇」。')
      } })
    },
  }],
}


