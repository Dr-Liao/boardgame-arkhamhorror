// 06082 堕落的护工（Corrupted Orderly）
// 归属：关卡专用 · theDreamEaters/wakingNightmare（P8-1 w-p8-a）。
// 卡面：猎手。强制 - 当堕落的护工在寄生地点受到 1 点或更多伤害时：取消其中 1 点伤害。
// 读点：章节 enemyDamageAmount 在伤害落下前取消 1 点，取消的伤害不会触发受伤效果。
export default {
  code: '06082',
  scope: 'enemy',
  implemented: true,
  flags: {
    cancelOneDamageAtInfestedLocation: true,
  },
}
