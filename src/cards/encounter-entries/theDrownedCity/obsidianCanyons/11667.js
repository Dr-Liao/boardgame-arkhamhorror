// 11667 · treachery · obsidianCanyons
//
// 恐怖之翼（×2）。显现：放进你的威胁区；每次检定失败：从遭遇牌库顶弃到敌人，抽取或让其攻击，然后弃掉本卡。encounterResolve → behavior.events.obsidianWingsOfTerror；失败在 behavior.afterTest。
// 读点：encounterResolve → api.resolveScenarioEvent('obsidianWingsOfTerror') → behavior.events.obsidianWingsOfTerror。
export default {
  code: '11667',
  scope: 'treachery',
  implemented: true,
  flags: { threatArea: true },
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('obsidianWingsOfTerror', { seat: inv.seat }) === true
  },
  note: "恐怖之翼（×2）。显现：放进你的威胁区；每次检定失败：从遭遇牌库顶弃到敌人，抽取或让其攻击，然后弃掉本卡。encounterResolve → behavior.events.obsidianWingsOfTerror；失败在 behavior.afterTest。",
}
