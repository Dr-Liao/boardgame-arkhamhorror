// 11650 · location · obsidianCanyons
//
// 漂浮尖塔。数值/未揭示面入场费同中央尖塔（locationRule.entryToll，读点 movement.js#relocateInvestigator）；
// 不能移动/离场由 locationRule 声明（引擎读点）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11650',
  scope: 'location',
  implemented: true,
  locationRule: { cannotLeavePlay: true, cannotBeMoved: true,
    entryToll: { unlessControls: ['11672a', '11672b'], cost: { clues: 1 },
      test: { skill: 'agility', difficulty: 2 }, cancelOnFail: true, onlyUnrevealed: true } },
  flags: { central: true, immovable: true, entryToll: true, cluesByResources: true },

  note: "漂浮尖塔。不能移动/离场（locationRule）；未揭示面入场费同中央尖塔（locationRule.entryToll，movement.js#relocateInvestigator：支付/失败取消/控制爪免收）；按印刷仅未揭示面生效（onlyUnrevealed: true，揭示后不再收费）。",
}
