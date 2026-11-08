// 08502 坠机点（Crash Site） · 地点 · ice_and_death
// 归属：战役共用 · edgeOfTheEarth/_shared。
// 卡面：[action]：检定[intellect]或[agility](3) 在残骸中搜寻。成功则在剧本日志「已回收的补给品」中记录备用零件（每个剧本最多一次成功）。庇护 0。
// 读点：地点能力走条目 abilities（非玩家能力来源含已揭示地点）；写入只走 ctx.api。
//   庇护值属印刷地点数据（章节 definition 从卡表/参考实现抄录；本条目只声明 flags.shelter）。

const CODE = '08502'
const SPARE_PARTS = '08620'
const RECORD_KEY = 'suppliesRecovered'

export default {
  code: CODE, scope: 'location', implemented: true,
  flags: { shelter: 0, campCandidate: true },
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '在残骸中搜寻：智力/敏捷(3)，成功记录「备用零件」',
    limit: { scope: 'perGame', owner: 'group' },
    resolve: ({ inv, api }) => {
      const skill = api.choice({ kind: 'skill', source: CODE, seat: inv.seat, prompt: '选择搜寻检定技能。',
        options: [{ id: 'intellect', label: '智力(3)' }, { id: 'agility', label: '敏捷(3)' }] })
      if (!['intellect', 'agility'].includes(skill)) return
      api.test(inv.seat, skill, 3, { source: { type: 'scenario', code: CODE, ability: true }, resolve: result => {
        if (!result.success) return
        api.mechanics.recordSets.add(RECORD_KEY, SPARE_PARTS)
        api.info('🔧 「坠机点」：在剧本日志记录「备用零件」。')
      } })
    },
  }],
}


