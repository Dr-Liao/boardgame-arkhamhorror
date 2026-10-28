// 02198 怪兽的美餐
// 归属：关卡专用 · bloodOnTheAltar（血色祭坛）
// 遭遇组：blood_on_the_altar
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { activeInvestigators } from '../../_shared.js'

export default {
  code: '02198', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      for (const inv of activeInvestigators(state)) api.markResigned(inv.seat)
      api.finish('noResolution')
    },
  },
}
