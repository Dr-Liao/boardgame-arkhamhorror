// 06082 堕落的护工（Corrupted Orderly）
// 归属：关卡专用 · theDreamEaters/wakingNightmare（P8-1 w-p8-a）。
// 卡面：猎手。强制 - 当堕落的护工在寄生地点受到 1 点或更多伤害时：取消其中 1 点伤害。
// 读点（Lead 口径 3）：条目声明 flags，章节 behavior.enemyDamaged（共享 enemyDamaged 之后）读
//   entryFlags('06082').cancelOneDamageAtInfestedLocation：若该敌人位于寄生地点且本次伤害 ≥1，
//   用 api.healEnemy(enemy, 1) 把 1 点伤害撤回（= 取消其中 1 点）。
export default {
  code: '06082',
  scope: 'enemy',
  implemented: true,
  flags: {
    cancelOneDamageAtInfestedLocation: true,
  },
}
