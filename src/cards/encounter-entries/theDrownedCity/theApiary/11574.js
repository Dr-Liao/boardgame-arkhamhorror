// 11574 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11574',
  scope: 'enemy',
  implemented: true,
  note: "印刷：猎手、反击；（[[武器]]攻击后在其上放 1 毁灭）。行为：data-type + behavior.spawnEnemy（议程 1 背面洗入遭遇牌库）；「武器攻击后放毁灭」未接线（近似）。",
  abilities: [],
}
