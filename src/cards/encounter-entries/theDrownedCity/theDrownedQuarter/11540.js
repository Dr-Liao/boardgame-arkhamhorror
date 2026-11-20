// 11540 · 淹没城区（theDrownedQuarter）单卡条目。
// 归属：关卡专用 · theDrownedCity/theDrownedQuarter（P7 淹没城区，参考卡 11536）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11540',
  scope: 'location',
  implemented: true,
  note: "data-type：未激活面（shroud 4 / 1 线索每人）。规则在 behavior：syncBarrierCore 按「已揭示且未淹没的[[海底]]地点 ≥6 / ≤5」翻面；actions「dqBarrierCoreDivert」降低核心淹没、提高一处相邻地点淹没并在其上放 3/人线索（团队每轮一次）。",
  abilities: [],
}
