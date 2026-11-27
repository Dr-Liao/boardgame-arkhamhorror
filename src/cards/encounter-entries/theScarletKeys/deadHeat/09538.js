// 09538 拉辛·法瑞（复生的工匠）
// 归属：关卡专用 · theScarletKeys/deadHeat（P7 死亡酷暑）。
// 卡面：警戒。猎手。反击。强制 - 任意密钥变换后：若拉辛·法瑞已横置，重整他；否则他对交战调查员发动一次即时攻击。
//
export default {
  code: '09538',
  scope: 'enemy',
  implemented: true,
  flags: {
    razin: true,
    reactsToKeyShift: true,
    readyOrAttackAfterShift: true,
  },
  abilities: [{
    kind: 'forced',
    trigger: ['tskKeyShifted'],
    label: '密钥变换后：重整拉辛·法瑞，或攻击与他交战的调查员',
    criteria: [({ source }) => Boolean(source.exhausted || Number.isSafeInteger(source.engagedSeat))],
    resolve: ({ source, api }) => {
      if (source.exhausted) return api.readyEnemy(source)
      return api.enemyAttackByCard(source, '拉辛·法瑞：密钥变换后', source.engagedSeat)
    },
  }],
}
