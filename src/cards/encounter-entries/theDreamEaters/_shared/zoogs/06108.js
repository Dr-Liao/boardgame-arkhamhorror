// 06108 隐蔽的祖格鼠（Inconspicuous Zoog，敌人，1 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：zoogs（TSK）。
// 卡面：Spawn - 任意连接地点。猎手。Swarming 2。
//       强制 - 隐蔽的祖格鼠被击败时：取消所有超出伤害，并把其余的蜂拥/头领卡牌移动到
//       一个连接地点，呈横置状态。
// 实现：猎手/Swarming 2 由 definition 解析；生成规则写 flags.spawn（任意连接地点，由共享层
//   spawnLocation 数据分派）；「击败时取消超出伤害并搬动剩余蜂拥卡」需要击败结算读点
//   （引擎 enemyScript.onDefeated 只能接管整个击败流程），已登记 coordinator request。
export default {
  code: '06108',
  scope: 'enemy',
  implemented: true,
  flags: {
    spawn: { kind: 'anyConnectingLocation' },
    defeatedMovesSwarmCards: { cancelExcess: true, exhaust: true },
  },
  simplified: true,
  note: '生成地点已由共享 spawnLocation 数据分派；「击败时取消超出伤害并搬动剩余蜂拥卡」需要击败结算的内容读点（引擎无通道）。',
}
