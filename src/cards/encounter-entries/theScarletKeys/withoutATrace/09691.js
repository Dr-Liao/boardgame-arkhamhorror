// 09691 原生质重组者（Protoplasmic Reassembler）· enemy
//
// 归属：关卡专用 · theScarletKeys/withoutATrace（P7）。
// 卡面（中）：庞大。
//   生成 - 离所有调查员最远的地点。
//   强制 - 当敌军阶段结束时，如果本敌人处于重整状态：将最近的调查员牌库顶的卡牌正面朝下
//   生成在本敌人的地点，作为一个魔像敌人。魔像拥有：「怪物，域外 猎手。1 攻击值、1 生命值、
//   1 躲避值、1 伤害值。如果魔像被击败，将其放在一边，位于场外，作为一个空洞。」
//   胜利 1。
//
// 读点：
//   · `spawnFarthestFromAll: true` —— 引擎 enemies.js#spawnEnemy 的生成地点读点（「生成 - 最远地点」）；
//   · enemyRule.golemSpawn → behavior.enemyPhaseEnd（敌军阶段结束时生成魔像）。
// 魔像没有卡号，引擎也没有「无卡号敌人实体」原语：本章把牌库顶卡直接放在一边作为空洞
// （即「魔像被击败后的去向」），并记进 `scenarioFlags.withoutATrace.golems` 台账。
// 见 docs 的 primitive-requests/09691.json。
export default {
  code: '09691',
  name: '原生质重组者',
  scope: 'enemy',
  implemented: true,
  spawnFarthestFromAll: true,
  note: 'approximation: 魔像以「最近的调查员牌库顶卡放在一边作为空洞」实现（引擎没有无卡号敌人实体）；'
    + '胜利 1 走卡表 victory。',
  enemyRule: {
    golemSpawn: true,
  },
}
