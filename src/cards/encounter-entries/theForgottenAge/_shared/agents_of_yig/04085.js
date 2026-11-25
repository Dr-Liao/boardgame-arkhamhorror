// 04085 伊格的诅咒
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：agents_of_yig
// 卡面：显现 - 将伊格的诅咒放置入场，放到你的威胁区域。
// 卡面：你得到-1[combat]，-1生命值，并获得[[蛇族]]特性。
// 卡面：[action]：检定[willpower](2)。胜利区每有一点复仇点数，本次检定难度+1。如果你检定成功，弃掉伊格的诅咒。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04085', implemented: true, scope: 'treachery',
  treacheryRule: { threatArea: true },
  modifiers: [{ target: 'add:investigatorTrait', value: 'Serpent' }],
  threatAction: { rule: 'endCurseOfYig', label: '检定意志(2+复仇)摆脱伊格的诅咒', skills: ['willpower'], difficulty: 2, target: 'threat', vengeance: true, sameLocation: true },
  encounterResolve(state, inv, card, api) {
    api.threat(inv.seat, '04085', { threatEffect: { statModifiers: { combat: -1 }, healthModifier: -1 } })
    return true
  },
}
