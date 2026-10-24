// 05336 舞者之雾（3 张）
// 宇宙 -：必须与右方连接；或失去 2 资源，与一个相邻地点的任意方向连接
// （behavior.placeCosmosLocation 按 definition.locations[].cosmos 的 direction/cost 指令表执行）。
// 反应：你移动到舞者之雾后，移除冒险参考卡 1 资源，移动到任意一个连接地点。
// 引擎直读 locationRule.onEnter.effect（移除参考卡资源记在 scenarioFlags.referenceResources）。
export default {
  code: '05336',
  scope: 'location',
  implemented: true,
  locationRule: {
    onEnter: {
      effect(state, location, api, inv) {
        const flags = state.scenarioFlags ||= {}
        const resources = Number(flags.referenceResources || 0)
        if (resources < 1) return
        const connections = (location.connections || [])
          .filter(id => (state.locations || []).some(candidate => candidate.id === id))
        if (!connections.length) return
        const options = [{ id: 'skip', label: '不移动' }, ...connections.map(id => ({
          id,
          label: `移动到「${(state.locations.find(candidate => candidate.id === id) || {}).name || id}」`,
        }))]
        const answer = api.choose({
          kind: 'location', source: location.id, seat: inv.seat,
          prompt: '舞者之雾：移除冒险参考卡 1 资源，移动到一个连接地点。', options,
        })
        if (answer === 'skip' || !connections.includes(answer)) return
        flags.referenceResources = resources - 1
        api.moveInvestigator(inv.seat, answer)
        api.info(`💨 舞者之雾把 ${inv.name} 送到「${(state.locations.find(candidate => candidate.id === answer) || {}).name || answer}」。`)
      },
    },
  },
}