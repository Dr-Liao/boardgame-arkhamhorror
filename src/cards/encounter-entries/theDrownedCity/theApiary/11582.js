// 11582 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11582',
  scope: 'storyAsset',
  implemented: true,
  flags: {"glyphLine":["j","m","s","c","b"]},
  note: "印刷：横置解除与所有交战敌人的交战，直到你的下个回合开始不能移动/造成伤害/交战；符文 j/m/s/c/b 集齐后 [fast] 受到 1 点直接恐惧并横置：对所在地点一名敌人造成 2 点伤害。已接线的读点：结局时若仍被控制则记录 grislyMask（behavior.controlledGrislyMask / resolution）。近似：两个 [fast] 能力未接线（需要玩家资产行动入口），只声明字形行。",
  abilities: [],
}
