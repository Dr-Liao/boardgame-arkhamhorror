// 12007 特里希·斯卡波罗（Trish Scarborough）· 流浪者 · 前特工（2026 核心盒）。
//
// 卡面：
//   你可以在自己回合期间进行额外一个行动，该行动只能用于躲避。
//   [elder_sign] 效果：+0。本次检定结算后，你可以与每个敌人解除交战并移动到一个连接地点。
//
// 引擎读点：
//   · 常态受限额外行动：条目级 `investigator.restrictedAction = { kind: 'evade' }` 由
//     src/engine/restricted-actions.js 的 restrictedActionRule 校验，turn.js 回合开始时
//     grantRestrictedAction 发放 1 个受限额度；行动归类在 table-decisions.js#restrictedKindOfMove
//     （kind === 'evade' 时命中 evadeOnlyActions）。
//   · 旧印：`{ delta: 0, onSuccessAlways: true, onSuccess: { type: 'moveTo', optional: true } }`；
//     tests.js 在成败判定后用 resolveEffect 结算；moveTo 效果（movement.js#moveInvestigatorTo）
//     会先与全部交战敌人解除交战再移动，与卡面同义；optional 给「可以不移动」的询问。

const code = '12007'

export default {
  code,
  kind: 'investigator',
  investigator: {
    elderSign: { bonus: 0 },
    restrictedAction: { kind: 'evade' },
  },
  elderSign: {
    id: '12007-eldersign',
    label: '旧印：+0。本次检定结算后，可与每个敌人解除交战并移动到一个连接地点',
    resolve: () => ({
      delta: 0,
      onSuccessAlways: true,
      onSuccess: { type: 'moveTo', optional: true, source: '12007' },
    }),
  },
  abilities: [],
  modifiers: [],
}
