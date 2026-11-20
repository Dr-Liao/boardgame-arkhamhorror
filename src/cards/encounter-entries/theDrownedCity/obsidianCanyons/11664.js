// 11664 · treachery · obsidianCanyons
//
// 剥蚀壁画[rune_e]（放一边，由西墙/古代圆顶揭示抽取）。显现以真实遭遇附属实例附着到所在地点（behavior.drawErodedFrieze → api.attachEncounterToLocation）；若将离场则放一边（leavesPlayTo:'setAside' + 引擎 discardEncounterAttachment 读点）；[action][战斗]或[智识](3)，成功放 1 资源，达到 1[per_investigator] 翻面记录 rune_e「黑暗」并进胜利区。encounterResolve → behavior.events.obsidianErodedFrieze。
// 读点：encounterResolve → api.resolveScenarioEvent('obsidianErodedFrieze') → behavior.events.obsidianErodedFrieze。
export default {
  code: '11664',
  scope: 'treachery',
  implemented: true,
  // 印刷「若剥蚀壁画将离场，放在一边，位于场外」：读点 scenario-decks.js#discardEncounterAttachment。
  leavesPlayTo: 'setAside',
  flags: { attachToLocation: true, glyph: 'rune_e', glyphWord: 'Darkness' },
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('obsidianErodedFrieze', { seat: inv.seat }) === true
  },
  note: "剥蚀壁画[rune_e]（放一边，由西墙/古代圆顶揭示抽取）。显现附属到所在地点；[action][战斗]或[智识](3)，成功放 1 资源，达到 1[per_investigator] 翻面记录 rune_e「黑暗」并进胜利区。encounterResolve → behavior.events.obsidianErodedFrieze。",
}
