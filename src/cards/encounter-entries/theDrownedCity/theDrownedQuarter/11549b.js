// 11549b · 淹没城区（theDrownedQuarter）单卡条目。
// 归属：关卡专用 · theDrownedCity/theDrownedQuarter（P7 淹没城区，参考卡 11536）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11549b',
  scope: 'storyAsset',
  implemented: true,
  note: "data-type（双面卡的故事面）。攻击后翻面 → 移动到连接地点（尽可能无调查员）；离场翻面 → 记录符文 [X]（发现「总和」）并把本卡加入胜利区。行为在 behavior.flipUnderseaParasite。",
  abilities: [],
}
