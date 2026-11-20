// 11577 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11577',
  scope: 'treachery',
  implemented: true,
  treacheryRule: {"test":{"skill":"willpower","difficulty":{"base":0,"plus":"shroud"},"fail":{"kind":"takeDamage","amount":1}}},
  note: "印刷：显现 - 意志(X)，X = 所在地点隐藏值；失败受 1 点伤害，并从遭遇牌库顶弃到一名[[偷渡者]]敌人并抽取。已接线：treacheryRule.test（检定 + 失败 1 伤害；引擎 treachery-tokens.js 读点）。近似：「弃到偷渡者敌人并抽取 / 弃掉的地点洗回牌库」未接线。",
  abilities: [],
}
