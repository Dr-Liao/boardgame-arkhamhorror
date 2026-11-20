// 11549 · 淹没城区（theDrownedQuarter）单卡条目。
// 归属：关卡专用 · theDrownedCity/theDrownedQuarter（P7 淹没城区，参考卡 11536）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11549',
  scope: 'enemy',
  implemented: true,
  flags: {"setAside":true},
  note: "印刷：冷漠、反击；攻击后 / 将要离场时翻面结算故事（11549b）。行为在 behavior：enemyAttackResolved（攻击后 → 翻面移动到一处连接地点并横置）、enemyDefeated（被击败 → 符文 X + 胜利区）、enemyLeftPlay（非击败离场：discarded/setAside/removed → 翻面结算故事面：符文 X + 胜利区；与既有 enemyDiscarded 择一消费，本章只实现 enemyLeftPlay）。P7 第三轮原语 `scenarioBehavior.enemyWouldBeSetAside`：放一边路径下，enemyLeftPlay('setAside') 完成翻面/符文/胜利区后返回 true，引擎因此在压入 setAsideEnemies 之前跳过默认入列——故事面与「放一边」不再并存。全部子句已接线（discard / removed / setAside 三条引擎路径均有测试）。",
  abilities: [],
}
