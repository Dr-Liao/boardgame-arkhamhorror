// 11559 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11559',
  scope: 'location',
  implemented: true,
  note: "data-type：养育场入口·引诱之光（shroud 1 / 1 线每个人；双面，背面 = 11559b 危险出口）。规则在 behavior：actions「apiaryEntranceFast」（[fast] 每轮一次，离入口最远地点放线索直到线索值）；「shuffle locations from discard into bottom 10」与撤退未接线（近似）。",
  abilities: [],
}
