// 03202 第二夜
// 归属：关卡专用 · aPhantomOfTruth（卡尔克萨之路 · 真相幻影）
// 遭遇组：a_phantom_of_truth
// 卡面：你的确信高于疑惑时，本密谋获得：
// 卡面：“在检查毁灭阈值时，改为从场上毁灭标记总数中减去本密谋以外的其他卡牌上的毁灭标记数，而不是加上。”
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { moveOrganistAway } from '../../_shared.js'

export default {
  code: '03202', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) {
        for (const enemy of state.enemies.filter(candidate => candidate.engagedSeat === inv.seat)) enemy.engagedSeat = null
        const location = state.locations.find(candidate => candidate.id === inv.location)
        const choices = (location?.connections || []).filter(id => state.locations.some(candidate => candidate.id === id))
        if (!choices.length) continue
        const answer = api.choose({
          kind: 'location', source: agenda.originalCode, seat: inv.seat, canSkip: true,
          prompt: '拂晓：你可以移动到一个连接地点。',
          options: [{ id: 'skip', label: '留在原地' }, ...choices.map(id => ({ id, label: api.locationName(id) }))],
        })
        if (answer !== 'skip') api.moveInvestigator(inv.seat, answer)
      }
      moveOrganistAway(state, api)
      const records = state.campaign.records || {}
      if (!(records.vipsSlain || []).includes('03066') && !state.enemies.some(enemy => enemy.code === '03066b')) {
        api.spawn('03066b', 'montparnasse')
      }
    },
  },
}
