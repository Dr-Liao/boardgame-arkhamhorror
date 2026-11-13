// 09657 结社煽动者（Coterie Provocateur）· 敌人 · dogs_of_war
//
// 归属：关卡专用 · theScarletKeys/dogsOfWar（P7）。印刷 2 份，进遭遇牌库。
// 卡面（中）：冷漠。巡逻(有钥匙节点的最近地点)。
//   生成 - 有钥匙节点的最近地点。
//   结社煽动者处于重整状态时，其地点的调查员不能攻击名称非结社煽动者的任何游戏元素。
//
// 读点：
//   · 冷漠/巡逻 → definition 的 `enemies` 表 + behavior.enemyPhaseStart（tsk-coterie 的巡逻目标/路径）；
//   · 「生成 - 有钥匙节点的最近地点」→ behavior.enemySpawned 读 `enemyRule.spawnNearestKeyLocus`；
//   · 「重整时其地点的调查员不能攻击其它元素」→ behavior.canFightEnemy 读
//     `enemyRule.blocksOtherAttacksWhileReady`（引擎 canFightEnemy 的唯一读点）。
export default {
  code: '09657',
  name: '结社煽动者',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    aloof: true,
    patrol: { target: 'keyLocus' },
    spawnNearestKeyLocus: true,
    blocksOtherAttacksWhileReady: true,
  },
  note: 'approximation: 「不能攻击名称非结社煽动者的任何游戏元素」只接线了敌人攻击（canFightEnemy）；'
    + '攻击钥匙节点（本章的剧本行动）与支援目标不受该限制，因为引擎的攻击限制读点只覆盖敌人候选。',
}
