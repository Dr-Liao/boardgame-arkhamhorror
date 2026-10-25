// 05094 苦痛折磨
// 归属：战役共用 · theCircleUndone；遭遇组：witchcraft
// 卡面：显现 - 将苦痛折磨放置入场，放到你的威胁区域。
// 卡面：你不能触发你控制的卡牌上的 [action] 能力。
// 卡面：[action]：检定[willpower](3)。如果你检定成功，弃掉苦痛折磨。
//   如果你所在地点有处于横置状态的[[女巫]]敌人，本次检定自动成功。
//
// 「不能触发你控制的卡牌上的 [action] 能力」用条目级威胁数据 threatEffect 声明：
// 引擎 moves.js 的 actionAbilityBlocked 读 registeredEntry(card.code)?.threatEffect?
// .cannotTriggerActionAbilities，在 legalMoves 过滤行动型（cost.action !== false）的资产能力、
// 在 validateMove 的同名校验里拒绝；免费/快速能力（cost.action === false）与地点/敌人行动、
// 威胁区的摆脱行动不受影响（测试见 tests/tcu-prologue.test.mjs 的 legalMoves 用例）。
// 威胁区、摆脱行动与「横置女巫时自动成功」由共享 encounter-rules 的威胁行动读点实现。

export default {
  code: '05094',
  scope: 'treachery',
  implemented: true,
  // 引擎读点：受影响的调查员不能触发其控制卡牌上的 [action] 能力（moves.js）。
  threatEffect: { cannotTriggerActionAbilities: true },
  treacheryRule: { threatArea: true },
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
