// 02162 后退
// 归属：关卡专用 · theEssexCountyExpress（疯狂列车）
// 遭遇组：essex_county_express
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { activeInvestigators } from '../../_shared.js'

export default {
  code: '02162', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      for (const loc of state.scenarioZones.train.splice(0, 2)) api.devourLocation(loc)
      for (const inv of activeInvestigators(state)) inv.clues = 0
      state.clues = 0
    },
  },
}
