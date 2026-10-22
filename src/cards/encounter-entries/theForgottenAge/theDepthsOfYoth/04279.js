// 04279 恐惧渐生
// 归属：关卡专用 · theDepthsOfYoth（失落的时代 · 幽嘶深渊）
// 遭遇组：the_depths_of_yoth
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 109 轮：幽嘶深渊的四个密谋揭示。

import { tfaPlacePursuit } from '../../_shared.js'

export default {
  code: '04279', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      tfaPlacePursuit(state, api)
      const active = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
      const withCanteen = active.filter(inv => api.checkSupplies(inv.seat, 'canteen'))
      if (!withCanteen.length) return
      const holder = withCanteen.length === 1 ? withCanteen[0] : state.investigators[Number(api.choose({
        kind: 'investigator', source: '04279', seat: state.campaign.leadSeat,
        prompt: '谁带水壶？该调查员决定是否收集这种奇怪的液体。',
        options: withCanteen.map(inv => ({ id: String(inv.seat), label: inv.name })),
      }))] || withCanteen[0]
      const answer = api.choose({
        kind: 'story', source: '04279', seat: holder.seat,
        prompt: '这可能有用。要不要收集这种奇怪的液体？',
        options: [{ id: 'collect', label: '收集（记住“收集了一种奇怪的液体”）' },
          { id: 'leave', label: '我不靠近它半步' }],
      })
      if (answer !== 'collect') return
      const flags = (state.scenarioFlags ||= {})
      flags.collectedAStrangeLiquid = true
      api.privateInfo?.(holder.seat, '你在剧本日志里记住：你“收集了一种奇怪的液体”。')
    },
  },
}
