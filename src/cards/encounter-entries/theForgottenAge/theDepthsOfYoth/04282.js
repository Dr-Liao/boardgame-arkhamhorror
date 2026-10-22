// 04282 撼地之怒
// 归属：关卡专用 · theDepthsOfYoth（失落的时代 · 幽嘶深渊）
// 遭遇组：the_depths_of_yoth
// 卡面：强制 -  在第三个毁灭标记被放置到本密谋上后：找出躲避值最高且处于追击中的敌人，将它生成在本深度等级开始时调查员所在的地点。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { tfaPlacePursuit } from '../../_shared.js'

export default {
  code: '04282', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      tfaPlacePursuit(state, api)
      const zones = (state.scenarioZones ||= {})
      const index = (zones.setAside || []).indexOf('04296')
      if (index < 0) return
      zones.setAside.splice(index, 1)
      const start = state.scenarioFlags?.depthStartLocation
      const enemy = api.spawn('04296', start)
      if (enemy) api.info?.(`伊格在「${start}」现身。`)
      else zones.setAside.push('04296')
    },
    onDoomPlaced(state, payload, api) {
      if (!payload?.agenda) return
      const flags = (state.scenarioFlags ||= {})
      flags.furyDoomPlaced ||= {}
      const key = String(state.agendaIndex)
      flags.furyDoomPlaced[key] = (flags.furyDoomPlaced[key] || 0) + (payload.amount || 0)
      if (flags.furyDoomPlaced[key] < 3) return
      if (flags.furyDoomThird) return
      flags.furyDoomThird = true
      tfaPlacePursuit(state, api)
    },
  },
}
