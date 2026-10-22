// 04278 开始下降
// 归属：关卡专用 · theDepthsOfYoth（失落的时代 · 幽嘶深渊）
// 遭遇组：the_depths_of_yoth
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { tfaPlacePursuit } from '../../_shared.js'

export default {
  code: '04278', scope: 'agenda',
  agendaRule: { onReveal(state, agenda, api) { tfaPlacePursuit(state, api) } },
}
