// 05094 苦痛折磨
// 归属：战役共用 · theCircleUndone；遭遇组：witchcraft
// 卡面：显现 - 将苦痛折磨放置入场，放到你的威胁区域。
// 卡面：你不能触发你控制的卡牌上的 [action] 能力。
// 卡面：[action]：检定[willpower](3)。如果你检定成功，弃掉苦痛折磨。
//   如果你所在地点有处于横置状态的[[女巫]]敌人，本次检定自动成功。
//
// 显式简化：引擎只有「禁止免费能力 / 禁止地点能力」两种禁止读点，没有「禁止资产 [action]
// 能力」的钩子（moves.js 的 legalMoves 不区分 [action] 来源）；该句记入 status.json gaps。
// 威胁区与摆脱行动照常实现。

export default {
  code: '05094',
  scope: 'treachery',
  implemented: true,
  simplified: true,
  note: '「你不能触发你控制的卡牌上的 [action] 能力」没有引擎读点（只有免费能力/地点能力禁止），只实现威胁区与摆脱行动。',
  treacheryRule: { threatArea: true, cannotTriggerActionAbilities: true },
  threatAction: {
    rule: 'discardBedeviled',
    label: '检定意志(3)摆脱苦痛折磨',
    skills: ['willpower'],
    difficulty: 3,
    target: 'threat',
    autoSuccessWhen: 'exhaustedWitchHere',
  },
  encounterResolve(state, inv, card, api) {
    api.threat(inv.seat, '05094')
    api.info?.('「苦痛折磨」进入你的威胁区域。')
    return true
  },
}
