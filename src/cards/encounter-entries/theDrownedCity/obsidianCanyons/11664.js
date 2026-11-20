// 11664 · treachery · obsidianCanyons
//
// 剥蚀壁画[rune_e]（放一边，由西墙/古代圆顶揭示抽取）。显现附属到所在地点；[action][战斗]或[智识](3)，成功放 1 资源，达到 1[per_investigator] 翻面记录 rune_e「黑暗」并进胜利区。encounterResolve → behavior.events.obsidianErodedFrieze。
// 读点：encounterResolve → api.resolveScenarioEvent('obsidianErodedFrieze') → behavior.events.obsidianErodedFrieze。
export default {
  code: '11664',
  scope: 'treachery',
  implemented: true,
  flags: { attachToLocation: true, glyph: 'rune_e', glyphWord: 'Darkness' },
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('obsidianErodedFrieze', { seat: inv.seat }) === true
  },
  note: "剥蚀壁画[rune_e]（放一边，由西墙/古代圆顶揭示抽取）。显现附属到所在地点；[action][战斗]或[智识](3)，成功放 1 资源，达到 1[per_investigator] 翻面记录 rune_e「黑暗」并进胜利区。encounterResolve → behavior.events.obsidianErodedFrieze。",
}
