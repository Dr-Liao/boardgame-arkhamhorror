// 11666 · treachery · obsidianCanyons
//
// 恐高症（×2）。显现：意志(1 + 相邻开阔天空数)；每低于难度 1 点必须失去 1 次行动或受 1 恐惧。encounterResolve → behavior.events.obsidianAcrophobia。
// 读点：encounterResolve → api.resolveScenarioEvent('obsidianAcrophobia') → behavior.events.obsidianAcrophobia。
export default {
  code: '11666',
  scope: 'treachery',
  implemented: true,
  flags: { test: { skills: ['willpower'], difficultyBase: 1, plusAdjacentOpenSky: true } },
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('obsidianAcrophobia', { seat: inv.seat }) === true
  },
  note: "恐高症（×2）。显现：意志(1 + 相邻开阔天空数)；每低于难度 1 点必须失去 1 次行动或受 1 恐惧。encounterResolve → behavior.events.obsidianAcrophobia。",
}
