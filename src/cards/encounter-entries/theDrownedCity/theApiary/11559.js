// 11559 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11559',
  scope: 'location',
  implemented: true,
  note: "data-type：养育场入口·引诱之光（shroud 1 / 1 线每个人；双面，背面 = 11559b 危险出口）。规则在 behavior：actions「apiaryEntranceFast」（[fast] 每轮一次，离入口最远地点放线索直到线索值）、「apiaryEntranceShuffleLocations」（[action] 共同花费 1[per_investigator] 线索：把遭遇弃牌堆中的每处地点洗入遭遇牌库底 10 张，复用既有 shuffleIntoBottom 助手）；[action] 撤退由定义 START_LOCATION.resign = true + 引擎既有 resign 行动结算。全部子句已接线。",
  abilities: [],
}
