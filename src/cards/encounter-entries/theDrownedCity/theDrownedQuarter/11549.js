// 11549 · 淹没城区（theDrownedQuarter）单卡条目。
// 归属：关卡专用 · theDrownedCity/theDrownedQuarter（P7 淹没城区，参考卡 11536）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11549',
  scope: 'enemy',
  implemented: true,
  flags: {"setAside":true},
  note: "印刷：冷漠、反击；攻击后 / 将要离场时翻面结算故事（11549b）。行为在 behavior：enemyAttackResolved（攻击后 → 翻面移动到一处连接地点并横置）与 enemyDefeated（离场 → 符文 X + 胜利区）。近似：「将要离场」只挂在被击败路径上，未被「移出游戏」类效果覆盖。",
  abilities: [],
}
