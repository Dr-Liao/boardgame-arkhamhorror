// 02121 无处不在
// 归属：关卡专用 · theMiskatonicMuseum（米斯卡塔尼克博物馆）
// 遭遇组：the_miskatonic_museum
// 卡面：强制 - 在追猎恐魔入场时：将放在一边的暗影之子附属到追猎恐魔上，如果暗影之子已经附属，则在上面增加1资源。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { activeInvestigators } from '../../_shared.js'

export default {
  code: '02121', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      for (const inv of activeInvestigators(state)) api.defeat(inv, 'damage')
      api.finish('noResolution')
    },
  },
}
