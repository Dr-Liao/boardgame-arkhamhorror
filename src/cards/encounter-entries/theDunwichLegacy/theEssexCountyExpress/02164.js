// 02164 时间耗尽
// 归属：关卡专用 · theEssexCountyExpress（疯狂列车）
// 遭遇组：essex_county_express
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { activeInvestigators } from '../../_shared.js'

export default {
  code: '02164', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      for (const inv of activeInvestigators(state)) api.defeat(inv, 'horror')
      api.finish('r2')
    },
  },
}
