// 11669 · treachery · obsidianCanyons
//
// 迷失云中（×1，险境）。显现三选一：放 1 毁灭到当前密谋 / 每位调查员 2 直接恐惧 / 如非[elder_sign]符号标记般结算风卡强制。encounterResolve → behavior.events.obsidianLostInTheClouds。
// 读点：encounterResolve → api.resolveScenarioEvent('obsidianLostInTheClouds') → behavior.events.obsidianLostInTheClouds。
export default {
  code: '11669',
  scope: 'treachery',
  implemented: true,
  flags: { peril: true, chooseOne: ['agendaDoom', 'directHorror2', 'windsForced'] },
  encounterResolve(state, inv, card, api) {
    return api.resolveScenarioEvent('obsidianLostInTheClouds', { seat: inv.seat }) === true
  },
  note: "迷失云中（×1，险境）。显现三选一：放 1 毁灭到当前密谋 / 每位调查员 2 直接恐惧 / 如非[elder_sign]符号标记般结算风卡强制。encounterResolve → behavior.events.obsidianLostInTheClouds。",
}
