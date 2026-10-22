// 02085 亚弗戈蒙之光
// 归属：战役共用 · theDunwichLegacy（敦威治遗产）
// 遭遇组：bishops_thralls
// 卡面：险境。
// 卡面：显现 - 你必须将亚弗戈蒙之光附属到当前密谋或当前场景。
// 卡面：每张密谋／场景仅限1张。将所有伤害视为直接伤害，将所有恐惧视为直接恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02085', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    const code = card.originalCode || card.code
    const attached = state.scenarioFlags.lightOfAforgomon || []
    const options = ['act', 'agenda'].filter(type => !attached.some(item => item.type === type
      && item.index === state[type === 'act' ? 'actIndex' : 'agendaIndex']))
    if (!options.length) return false
    const chosen = options.length === 1 ? options[0] : api.choose({ kind: 'encounter', source: code, seat: inv.seat,
      prompt: '将亚弗戈蒙之光附属到当前密谋或当前场景（每张限 1 张）。',
      options: ['agenda', 'act'].filter(type => options.includes(type))
        .map(type => ({ id: type, label: type === 'act' ? '当前场景' : '当前密谋' })) })
    state.scenarioFlags.lightOfAforgomon = [...attached,
      { type: chosen, index: state[chosen === 'act' ? 'actIndex' : 'agendaIndex'] }]
    return true
  },
}
