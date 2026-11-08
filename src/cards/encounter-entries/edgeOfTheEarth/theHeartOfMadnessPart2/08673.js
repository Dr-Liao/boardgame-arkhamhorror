// 08673 坍塌高塔（Collapse the Pylons）· 幕 3
// 卡面：每座已揭示的迷雾高塔可被当作敌人攻击（fight=帷幕、health=线索值）；生命为 0 即坍塌。
// [reaction] 在迷雾高塔发现 1+ 线索时，花费那些线索：对高塔造成等量伤害。
// 目标 - 回合结束时，如果每座迷雾高塔都已坍塌，推进。背面：rampSequence。
export default {
  code: '08673',
  scope: 'act',
  implemented: true,
  actRule: {
    objective: { type: 'collapsePylons' },
    backEffect: 'rampSequence',
    pylonAttackable: true,
    clueReactionDamage: true,
  },
}
