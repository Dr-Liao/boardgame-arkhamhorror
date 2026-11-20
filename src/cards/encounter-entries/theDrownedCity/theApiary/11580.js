// 11580 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11580',
  scope: 'enemy',
  implemented: true,
  note: "印刷：反击；生命 1/人；被击败时翻面结算 11580b；将要离场时放一边场外。行为在 behavior.flipSquamousParasite（被击败 → 记录符文 [T]「空气」+ 胜利区；离场 → 放一边）与 enemyLeftPlay（非击败离场：discarded/setAside/removed → 撤销引擎默认去向并统一放入章节放一边记录；与既有 enemyDiscarded 择一消费，本章只实现 enemyLeftPlay）。",
  abilities: [],
}
