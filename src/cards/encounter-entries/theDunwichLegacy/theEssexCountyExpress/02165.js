// 02165 大家快跑！
// 归属：关卡专用 · theEssexCountyExpress（疯狂列车）
// 遭遇组：essex_county_express
// 卡面：目标 - 如果有调查员进入车头，立刻推进。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { activeInvestigators, scenarioLocationId } from '../../_shared.js'

export default {
  code: '02165', scope: 'act',
  actRule: {
    objective(state, { entered }) { return entered('02175') },
    onReveal(state, act, api) {
      const inv = activeInvestigators(state)
        .find(item => item.location === (scenarioLocationId(state, '02175') || 'location02175'))
      if (!inv) return
      const skill = api.choose({
        kind: 'story', source: act.originalCode || act.code, seat: inv.seat,
        prompt: '如何越过煤水车？',
        options: [{ id: 'agility', label: '敏捷（3）：躲避' }, { id: 'combat', label: '战斗（3）：承受高温' }],
      })
      api.test(inv.seat, skill, 3, result => {
        if (!result.success) api.trauma(inv.seat, skill === 'agility' ? 'mental' : 'physical', 1)
      })
    },
  },
}
