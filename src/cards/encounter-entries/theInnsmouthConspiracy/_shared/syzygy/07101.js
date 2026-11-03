export default {
  code: '07101', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const active = state.investigators.filter(other => !other.defeated && !other.resigned)
    const options = []
    if (active.some(other => other.resources > 0)) options.push({ id: 'resources', label: '每名调查员失去3资源' })
    options.push({ id: 'horror', label: '每名调查员受到2恐惧' }, { id: 'doom', label: '当前密谋上放置1毁灭（可能推进密谋）' })
    const chosen = api.choose({ kind: 'effect', seat: inv.seat, source: '07101', prompt: '必须选择一项。', options })
    if (chosen === 'resources') for (const other of active) api.loseResources(other.seat, 3)
    else if (chosen === 'horror') for (const other of active) api.horror(other.seat, 2)
    else if (chosen === 'doom') api.addDoom(1)
    return false
  },
}
