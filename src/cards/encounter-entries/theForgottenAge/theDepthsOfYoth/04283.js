// 04283 赤红深渊
// 归属：关卡专用 · theDepthsOfYoth（失落的时代 · 幽嘶深渊）
// 遭遇组：the_depths_of_yoth
// 卡面：强制 - 在有毁灭标记被放置到本密谋上后：找出躲避值最高且处于追击中的敌人，将它生成在本深度等级开始时调查员所在的地点。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { tfaPlacePursuit } from '../../_shared.js'

export default {
  code: '04283', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      tfaPlacePursuit(state, api)
      state.scenarioFlags ||= {}
      state.scenarioFlags.redDepthsOngoing = true
      state.scenarioZones ||= {}
      state.scenarioZones.pursuitReminders ||= []
      const reminder = agenda.originalCode || agenda.code
      if (!state.scenarioZones.pursuitReminders.includes(reminder)) state.scenarioZones.pursuitReminders.push(reminder)
      api.info?.('赤红深渊：此后每次在本密谋上放置毁灭，都会把追击中的敌人放出来（放到追击区作提醒）。')
    },
    onDoomPlaced(state, payload, api) {
      if (payload?.agenda) tfaPlacePursuit(state, api)
    },
  },
}
