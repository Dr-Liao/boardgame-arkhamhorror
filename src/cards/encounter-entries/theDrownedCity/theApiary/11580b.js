// 11580b · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11580b',
  scope: 'storyAsset',
  implemented: true,
  note: "data-type（敌人背面故事）：被击败翻面后把本卡加入胜利区并记录符文 [T]「空气」。行为在 behavior.flipSquamousParasite；「安静移除敌人正面」用从 state.enemies 移出近似。",
  abilities: [],
}
