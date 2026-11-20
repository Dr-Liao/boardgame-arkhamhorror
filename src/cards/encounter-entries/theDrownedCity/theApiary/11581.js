// 11581 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11581',
  scope: 'storyAsset',
  implemented: true,
  note: "印刷：将要离场时放一边场外；受到 1 点或更多伤害后对它造成 1 点伤害；控制它结束游戏时翻面结算。行为：events.apiaryFlipAncientRelic → behavior.flipAncientRelic（符文 [S]「机器」+ 胜利区）。近似：资产行动触发（玩家资产入口）与「受伤后自伤」未接线。",
  abilities: [],
}
