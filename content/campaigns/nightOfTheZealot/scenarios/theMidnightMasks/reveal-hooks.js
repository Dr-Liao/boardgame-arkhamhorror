// 「午夜假面」密谋揭示（第 5 批从 src/engine/phases.js 的 runAgendaReveal 搬出）。
export function agendaReveal(state, ag, api, revealType) {
  if (revealType === 'spawnMaskedHunter') {
    const seats = state.investigators.filter(inv => !inv.defeated && !inv.resigned).map(inv => inv.seat)
    const target = seats.length
      ? api.preyTarget({ code: 'theMaskedHunter', name: '假面猎手', prey: 'mostClues' }, seats)
      : null
    const location = target != null ? state.investigators[target].location : state.scenario.startLocation
    const enemy = api.spawnEngaged('theMaskedHunter', location, target)
    if (enemy) {
      const name = target != null ? state.investigators[target].name : '无人'
      api.info(`👹 「${enemy.name}」现身，与 ${name} 交战！`)
    }
    return true
  }
  if (revealType === 'resolution2') {
    api.finish('r2')
    return true
  }
  return false
}
