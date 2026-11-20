// 11559b · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11559b',
  scope: 'location',
  implemented: true,
  note: "data-type：养育场入口·危险出口（双面卡背面）。已接线：behavior.spawnLocation（引擎既有生成落点钩子：[[偷渡者]]敌人的落点改为养育场入口）、behavior.actions「apiaryPutCultistUnder」（[action] 共同花费 1[per_investigator] 线索：把本地点一张[[异教徒]]支援或敌人放到本场景下方，api.choice 选择目标）、幕间翻面在 behavior.act1Back；[action] 撤退由定义 START_LOCATION.resign = true + 引擎既有 resign 行动结算。全部子句已接线。",
  abilities: [],
}
