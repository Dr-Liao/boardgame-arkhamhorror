// 08514 水晶洞穴（Crystalline Cavern） · 地点 · ice_and_death
// 归属：战役共用 · edgeOfTheEarth/_shared。
// 卡面：[action]：检定[agility](5) 爬上水晶墙寻找证据。成功则记录「瘴气水晶」（每个剧本最多一次成功）。背面：进入额外费用 4[per_investigator] 线索。庇护 8。
// 读点：地点能力走条目 abilities（非玩家能力来源含已揭示地点）；写入只走 ctx.api。
//   庇护值属印刷地点数据（章节 definition 从卡表/参考实现抄录；本条目只声明 flags.shelter）。

const CODE = '08514'
const MIASMIC_CRYSTAL = '08617'

export default {
  code: CODE, scope: 'location', implemented: true,
  flags: { shelter: 8, campCandidate: true, entryGroupCluesPerInvestigator: 4 },
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '攀爬 敏捷(5)：记录「瘴气水晶」',
    limit: { scope: 'perGame', owner: 'group' },
    resolve: ({ inv, api }) => {
      api.test(inv.seat, 'agility', 5, { source: { type: 'scenario', code: CODE, ability: true }, resolve: result => {
        if (!result.success) return
        api.mechanics.recordSets.add('suppliesRecovered', MIASMIC_CRYSTAL)
        api.info('💠 「水晶洞穴」：记录「瘴气水晶」。')
      } })
    },
  }],
}


